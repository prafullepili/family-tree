let locked = false;
const listeners = new Set();
export const TREE_LOCK_MESSAGE = 'The tree is locked. Unlock it to make changes.';
export const isTreeEditingLocked = () => locked;
export function setTreeEditingLocked(value) {
  if (locked === Boolean(value)) return;
  locked = Boolean(value);
  for (const listener of listeners) listener();
}
export function subscribeTreeEditLock(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function allowTreeEdit(readOnly, notify) {
  if (!readOnly && !locked) return true;
  notify?.(readOnly ? 'This tree is read-only.' : TREE_LOCK_MESSAGE);
  return false;
}
export function isTreeMutation(input, method = 'GET') {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return false;
  const path = new URL(typeof input === 'string' ? input : input?.url || String(input), 'http://local').pathname;
  return /^\/api\/(people|layouts|photos|trees)(\/|$)/.test(path);
}
