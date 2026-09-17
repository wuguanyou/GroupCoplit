'use client';
import { createContext, useContext, useCallback } from 'react';
export const ProjectContext = createContext('');
export function useProjectId() {
  return useContext(ProjectContext);
}
export function useProjectFetch() {
  const id = useProjectId();
  return useCallback(
    (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set('x-project-id', id);
      return fetch(url, { ...init, headers });
    },
    [id],
  );
}
