import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

/**
 * Use this hook instead of plain `useDispatch`
 * Reference: https://redux-toolkit.js.org/tutorials/typescript#define-typed-hooks
 */
export const useAppDispatch: () => AppDispatch = useDispatch;

/**
 * Use this hook instead of plain `useSelector`
 * Reference: https://redux-toolkit.js.org/tutorials/typescript#define-typed-hooks
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
