import { type ReactNode } from 'react';
import { ResizablePane } from './ResizablePane.js';

export function ResizableSidebar({ children }: { children: ReactNode }) {
  return (
    <ResizablePane
      side="left"
      storageKey="plancktons.sidebar.width"
      defaultWidth={360}
      minWidth={280}
      maxWidth={560}
      className="sidebar"
    >
      {children}
    </ResizablePane>
  );
}
