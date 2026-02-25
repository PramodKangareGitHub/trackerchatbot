export function getAuthToken(): string | null {
  return window.localStorage.getItem("auth_token");
}
