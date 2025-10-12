// lib/session.ts
const KEY = "counter:email";

export const setCounterEmail = (email: string) => {
  sessionStorage.setItem(KEY, email);
};

export const getCounterEmail = () => {
  return sessionStorage.getItem(KEY);
};

export const clearCounterEmail = () => {
  sessionStorage.removeItem(KEY);
};
