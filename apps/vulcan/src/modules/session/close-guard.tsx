'use client';

import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppSelector } from '@/modules/store';

export function CloseGuard() {
  const isProcessing = useAppSelector((state) => state.session.isProcessing);
  const [showDialog, setShowDialog] = useState(false);

  // the close-requested listener is registered once, so it reads the latest
  // value through a ref instead of re-registering on every state change
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested((event) => {
      if (isProcessingRef.current) {
        event.preventDefault();
        setShowDialog(true);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Processing in progress</AlertDialogTitle>
          <AlertDialogDescription>
            Vulcan is still processing. Closing the app now will stop the
            processing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep running</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => getCurrentWindow().destroy()}
          >
            Close anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
