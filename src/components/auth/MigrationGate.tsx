import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  isUserCutover,
  markUserCutover,
  getMigrationReport,
  migrateUserData,
  clearMigrationAcknowledgement,
  type MigrationRecordReport,
} from '../../services/migrationService';
import { Button } from '../ui/Button';
import {
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Database,
  Info,
} from 'lucide-react';

export type MigrationGateState =
  | 'checking'
  | 'migrating'
  | 'needs_attention'
  | 'acknowledged'
  | 'failed'
  | 'completed';

export interface MigrationGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export interface MigrationEvaluationResult {
  state: MigrationGateState;
  report: MigrationRecordReport | null;
  errorMessage?: string;
  shouldMigrate: boolean;
}

/**
 * Pure evaluation function for resolving the migration gate state for a given user.
 * In Increment 4, the authoritative cutover marker shelf_cutover_v1_USER is required
 * before granting access to the cloud-backed application.
 */
export function evaluateMigrationState(
  userId: string | null,
  options?: {
    isMigratedFn?: (id: string) => boolean;
    getReportFn?: (id: string) => MigrationRecordReport | null;
    isAckFn?: (id: string, ts?: string) => boolean;
    isCutoverFn?: (id: string) => boolean;
  }
): MigrationEvaluationResult {
  if (!userId || !userId.trim()) {
    return { state: 'completed', report: null, shouldMigrate: false };
  }

  const trimmedUserId = userId.trim();
  const checkCutover = options?.isCutoverFn || isUserCutover;
  const checkReport = options?.getReportFn || getMigrationReport;

  // 1. Authoritative check: If cutover is already complete, proceed to cloud app immediately
  if (checkCutover(trimmedUserId)) {
    return { state: 'completed', report: null, shouldMigrate: false };
  }

  // 2. Cutover marker is absent: inspect for existing failed or attention reports
  const report = checkReport(trimmedUserId);
  if (report) {
    if (report.errors && report.errors.length > 0) {
      return {
        state: 'failed',
        report,
        errorMessage: report.errors[0],
        shouldMigrate: false,
      };
    }

    const hasSkips =
      (report.collectionsSkipped || 0) > 0 ||
      (report.tagsSkipped || 0) > 0 ||
      (report.bookmarksSkipped || 0) > 0;

    if (hasSkips) {
      // In Increment 4 cutover: acknowledging an attention report does NOT bypass the cutover requirement.
      // The cutover gate remains active until reconciliation completes cleanly.
      return { state: 'needs_attention', report, shouldMigrate: false };
    }
  }

  // 3. Cutover is absent, no blocking report -> requires forced reconciliation
  return { state: 'migrating', report: null, shouldMigrate: true };
}

export const MigrationGate: React.FC<MigrationGateProps> = ({ children, fallback }) => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [gateState, setGateState] = useState<MigrationGateState>('checking');
  const [report, setReport] = useState<MigrationRecordReport | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Guard against race conditions during account switching
  const activeUserIdRef = useRef<string | null>(null);
  // Guard against concurrent competing executions for the same user
  const inFlightUserRef = useRef<string | null>(null);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);

  const runMigration = useCallback(
    async (userId: string, isRetry: boolean = false) => {
      if (activeUserIdRef.current !== userId) return;

      // Prevent concurrent duplicate runs for the same user
      if (inFlightUserRef.current === userId && inFlightPromiseRef.current && !isRetry) {
        await inFlightPromiseRef.current;
        return;
      }

      inFlightUserRef.current = userId;
      setGateState('migrating');
      setIsRetrying(isRetry);
      setProgressMessage(isRetry ? 'Retrying cloud data migration...' : 'Starting cloud data migration...');
      setErrorMessage(null);
      setAckError(null);

      const promise = (async () => {
        try {
          // Force reconciliation to sweep any local changes created after original migration
          const result = await migrateUserData(userId, {
            force: true,
            onProgress: (msg) => {
              if (activeUserIdRef.current === userId) {
                setProgressMessage(msg);
              }
            },
          });

          if (activeUserIdRef.current !== userId) return;

          setReport(result.report);

          if (result.state === 'completed') {
            // Only when genuinely completed, persist the cutover marker and verify
            const cutoverRes = markUserCutover(userId);
            if (cutoverRes.success) {
              setGateState('completed');
            } else {
              // Cutover marker persistence failed: block cloud access and present recoverable error
              setGateState('failed');
              setErrorMessage(
                cutoverRes.error || 'Failed to persist cutover completion marker. Please retry.'
              );
            }
          } else if (result.state === 'needs_attention') {
            // Unresolved skipped records block cutover
            setGateState('needs_attention');
          } else {
            // Reconciliation failure blocks cutover
            setGateState('failed');
            setErrorMessage(result.error || 'Cutover reconciliation failed unexpectedly.');
          }
        } catch (err) {
          if (activeUserIdRef.current !== userId) return;
          setGateState('failed');
          setErrorMessage(err instanceof Error ? err.message : String(err));
        } finally {
          if (inFlightUserRef.current === userId) {
            inFlightUserRef.current = null;
            inFlightPromiseRef.current = null;
          }
          if (activeUserIdRef.current === userId) {
            setIsRetrying(false);
          }
        }
      })();

      inFlightPromiseRef.current = promise;
      await promise;
    },
    []
  );

  const evaluateMigrationStatus = useCallback(
    async (userId: string) => {
      activeUserIdRef.current = userId;
      setGateState('checking');
      setErrorMessage(null);
      setAckError(null);

      const evaluation = evaluateMigrationState(userId);
      setReport(evaluation.report);
      setGateState(evaluation.state);

      if (evaluation.errorMessage) {
        setErrorMessage(evaluation.errorMessage);
      }

      if (evaluation.shouldMigrate) {
        await runMigration(userId, false);
      }
    },
    [runMigration]
  );

  useEffect(() => {
    if (isAuthLoading) {
      activeUserIdRef.current = null;
      setGateState('checking');
      setReport(null);
      setErrorMessage(null);
      setAckError(null);
      return;
    }

    const currentUserId = user?.id ? user.id.trim() : null;
    activeUserIdRef.current = currentUserId;

    if (!currentUserId) {
      setGateState('checking');
      setReport(null);
      setErrorMessage(null);
      setAckError(null);
      return;
    }

    evaluateMigrationStatus(currentUserId);
  }, [user?.id, isAuthLoading, evaluateMigrationStatus]);

  const handleRetry = () => {
    if (!user?.id) return;
    clearMigrationAcknowledgement(user.id);
    runMigration(user.id, true);
  };

  // ============================================================================
  // RENDER: Auth Loading Guard
  // ============================================================================
  if (isAuthLoading) {
    return (
      fallback || (
        <div className="min-h-screen bg-shelf-ivory dark:bg-shelf-dark flex flex-col items-center justify-center p-6 text-shelf-dark dark:text-shelf-ivory transition-colors">
          <div className="w-12 h-12 rounded-[16px] bg-shelf-dark dark:bg-shelf-ivory flex items-center justify-center p-2.5 mb-4 shadow-[0_6px_20px_rgba(201,75,54,0.18)] animate-pulse">
            <Database className="w-6 h-6 text-shelf-ivory dark:text-shelf-dark" />
          </div>
          <span className="font-editorial text-xl font-medium tracking-tight">
            Verifying Shelf Storage...
          </span>
          <span className="text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono mt-1">
            Checking authentication session
          </span>
        </div>
      )
    );
  }

  // ============================================================================
  // RENDER: Signed-Out Guard (Never expose authenticated children without a user)
  // ============================================================================
  if (!user?.id) {
    return fallback ? <>{fallback}</> : null;
  }

  // ============================================================================
  // RENDER: Checking State
  // ============================================================================
  if (gateState === 'checking') {
    return (
      fallback || (
        <div className="min-h-screen bg-shelf-ivory dark:bg-shelf-dark flex flex-col items-center justify-center p-6 text-shelf-dark dark:text-shelf-ivory transition-colors">
          <div className="w-12 h-12 rounded-[16px] bg-shelf-dark dark:bg-shelf-ivory flex items-center justify-center p-2.5 mb-4 shadow-[0_6px_20px_rgba(201,75,54,0.18)] animate-pulse">
            <Database className="w-6 h-6 text-shelf-ivory dark:text-shelf-dark" />
          </div>
          <span className="font-editorial text-xl font-medium tracking-tight">
            Verifying Shelf Storage...
          </span>
          <span className="text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono mt-1">
            Checking cloud migration status
          </span>
        </div>
      )
    );
  }

  // ============================================================================
  // RENDER: Migrating State
  // ============================================================================
  if (gateState === 'migrating') {
    return (
      <div className="min-h-screen bg-shelf-ivory dark:bg-shelf-dark flex flex-col items-center justify-center p-6 text-shelf-dark dark:text-shelf-ivory transition-colors">
        <div className="w-14 h-14 rounded-[20px] bg-shelf-surfaceLight dark:bg-shelf-surfaceDark border border-shelf-borderLight dark:border-shelf-borderDark flex items-center justify-center p-3 mb-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
          <RefreshCw className="w-7 h-7 text-shelf-terracotta animate-spin" />
        </div>
        <span className="font-editorial text-2xl font-medium tracking-tight text-center">
          {isRetrying ? 'Retrying Cloud Migration' : 'Migrating Shelf to the Cloud'}
        </span>
        <p className="text-sm text-shelf-muted dark:text-shelf-mutedDark max-w-md text-center mt-2 leading-relaxed">
          {progressMessage || 'Transferring your bookmarks, collections, and tags to authenticated cloud storage...'}
        </p>
        <span className="text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono mt-4 px-3 py-1 rounded-full bg-shelf-surfaceLight dark:bg-shelf-surfaceDark border border-shelf-borderLight dark:border-shelf-borderDark">
          Your local browser data is preserved safely as a backup
        </span>
      </div>
    );
  }

  // ============================================================================
  // RENDER: Needs Attention State (Blocking Modal / Screen)
  // ============================================================================
  if (gateState === 'needs_attention' && report) {
    const totalSkipped =
      (report.collectionsSkipped || 0) +
      (report.tagsSkipped || 0) +
      (report.bookmarksSkipped || 0);

    return (
      <div className="min-h-screen bg-shelf-ivory dark:bg-shelf-dark flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
        <div className="w-full max-w-lg bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight/90 dark:border-shelf-borderDark/90 rounded-[24px] shadow-[0_20px_50px_-10px_rgba(36,35,33,0.18)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] p-6 sm:p-8 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#E5855E]/15 dark:bg-[#E5855E]/20 flex items-center justify-center text-[#C94B36] shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-editorial text-2xl font-semibold tracking-tight">
                Migration Needs Attention
              </h2>
              <span className="text-xs text-shelf-muted dark:text-shelf-mutedDark font-mono">
                {totalSkipped} item{totalSkipped === 1 ? '' : 's'} could not be migrated automatically
              </span>
            </div>
          </div>

          <p className="text-sm text-shelf-muted dark:text-shelf-mutedDark leading-relaxed mb-5">
            Your valid records were successfully transferred to cloud storage. Some items were skipped due to malformed URLs, ambiguous timestamps, or duplicates. Your local data remains completely intact.
          </p>

          {/* Skipped Counts Summary */}
          <div className="grid grid-cols-3 gap-2.5 mb-5 text-center">
            <div className="p-3 rounded-[14px] bg-shelf-surfaceSubtle dark:bg-white/[0.04] border border-shelf-borderLight dark:border-shelf-borderDark">
              <span className="block text-lg font-bold font-mono text-shelf-dark dark:text-shelf-ivory">
                {report.collectionsSkipped || 0}
              </span>
              <span className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark uppercase tracking-wider">
                Collections
              </span>
            </div>
            <div className="p-3 rounded-[14px] bg-shelf-surfaceSubtle dark:bg-white/[0.04] border border-shelf-borderLight dark:border-shelf-borderDark">
              <span className="block text-lg font-bold font-mono text-shelf-dark dark:text-shelf-ivory">
                {report.tagsSkipped || 0}
              </span>
              <span className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark uppercase tracking-wider">
                Tags
              </span>
            </div>
            <div className="p-3 rounded-[14px] bg-shelf-surfaceSubtle dark:bg-white/[0.04] border border-shelf-borderLight dark:border-shelf-borderDark">
              <span className="block text-lg font-bold font-mono text-shelf-dark dark:text-shelf-ivory">
                {report.bookmarksSkipped || 0}
              </span>
              <span className="text-[11px] text-shelf-muted dark:text-shelf-mutedDark uppercase tracking-wider">
                Bookmarks
              </span>
            </div>
          </div>

          {/* Collapsible Warnings */}
          {report.warnings && report.warnings.length > 0 && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowWarnings(!showWarnings)}
                className="flex items-center justify-between w-full text-xs font-medium text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-terracotta py-1.5 transition-colors"
              >
                <span>Diagnostic details ({report.warnings.length} warning{report.warnings.length === 1 ? '' : 's'})</span>
                {showWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showWarnings && (
                <div className="mt-2 max-h-40 overflow-y-auto p-3 rounded-[12px] bg-shelf-ivory dark:bg-shelf-dark/80 border border-shelf-borderLight dark:border-shelf-borderDark text-xs font-mono text-shelf-muted dark:text-shelf-mutedDark space-y-1">
                  {report.warnings.map((warn, idx) => (
                    <div key={idx} className="leading-snug">• {warn}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {ackError && (
            <div className="mb-4 p-3 rounded-[12px] bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
              {ackError}
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-2 border-t border-shelf-borderLight/80 dark:border-shelf-borderDark/80">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={handleRetry}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Retry Cutover Reconciliation
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: Failed State
  // ============================================================================
  if (gateState === 'failed') {
    return (
      <div className="min-h-screen bg-shelf-ivory dark:bg-shelf-dark flex flex-col items-center justify-center p-6 text-shelf-dark dark:text-shelf-ivory transition-colors">
        <div className="w-full max-w-md bg-shelf-surfaceLight dark:bg-shelf-surfaceDark border border-red-500/30 rounded-[24px] shadow-[0_20px_50px_rgba(176,58,43,0.15)] p-6 sm:p-8 text-center animate-in fade-in-0 zoom-in-95">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="font-editorial text-2xl font-semibold tracking-tight mb-2">
            Migration Failed
          </h2>
          <p className="text-sm text-shelf-muted dark:text-shelf-mutedDark mb-4 leading-relaxed">
            {errorMessage || 'We encountered an error while trying to transfer your data to cloud storage. Your local data has not been modified.'}
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="primary"
              onClick={handleRetry}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Retry Migration
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: Acknowledged State (Renders Children + Non-Blocking Notice)
  // ============================================================================
  if (gateState === 'acknowledged') {
    return (
      <>
        {/* Non-intrusive persistent notice for acknowledged migrations with skipped items */}
        {report && (
          <aside
            aria-label="Migration notice"
            className="w-full bg-[#E5855E]/10 dark:bg-[#E5855E]/15 border-b border-[#E5855E]/30 text-shelf-dark dark:text-shelf-ivory px-4 py-2 text-xs flex items-center justify-between z-40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-shelf-terracotta shrink-0" />
              <span>
                Migration completed with{' '}
                <strong className="font-semibold">
                  {(report.collectionsSkipped || 0) +
                    (report.tagsSkipped || 0) +
                    (report.bookmarksSkipped || 0)}{' '}
                  skipped record(s)
                </strong>
                . Original local records remain backed up.
              </span>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="underline hover:text-shelf-terracotta font-medium ml-4 shrink-0"
            >
              Retry Migration
            </button>
          </aside>
        )}
        {children}
      </>
    );
  }

  // ============================================================================
  // RENDER: Completed State
  // ============================================================================
  return <>{children}</>;
};
