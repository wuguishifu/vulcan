'use client';

import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { setIsProcessing } from '../../modules/session';
import { useAppDispatch, useAppSelector } from '../../modules/store';

export default function Dev() {
  const dispatch = useAppDispatch();
  const isProcessing = useAppSelector((state) => state.session.isProcessing);

  return (
    <main>
      <div>
        <Label>
          <Checkbox
            checked={isProcessing}
            onCheckedChange={(checked) => dispatch(setIsProcessing(checked))}
          />
          Processing
        </Label>
      </div>
    </main>
  );
}
