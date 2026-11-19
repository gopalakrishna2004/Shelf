import React from 'react';
import { BookmarkModal, type BookmarkModalProps } from './BookmarkModal';

export type QuickAddModalProps = BookmarkModalProps;

/**
 * QuickAddModal is an alias of BookmarkModal to ensure backward compatibility
 * across all existing layout and test entry points.
 */
export const QuickAddModal: React.FC<QuickAddModalProps> = (props) => {
  return <BookmarkModal {...props} />;
};
