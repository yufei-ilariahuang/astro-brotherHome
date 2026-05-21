// Minimal dynamic helper wrapper for client usage
export async function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    // prefer global widget if available
    if ((window as any).netlifyIdentity && typeof (window as any).netlifyIdentity.currentUser === 'function') {
      return (window as any).netlifyIdentity.currentUser();
    }
    const mod = await import('@netlify/identity');
    return mod.getUser ? await mod.getUser() : null;
  } catch (e) {
    return null;
  }
}

export async function logout() {
  if (typeof window === 'undefined') return;
  try {
    if ((window as any).netlifyIdentity && typeof (window as any).netlifyIdentity.logout === 'function') {
      return (window as any).netlifyIdentity.logout();
    }
    const mod = await import('@netlify/identity');
    return mod.logout ? await mod.logout() : null;
  } catch (e) {
    return null;
  }
}

export async function openWidget() {
  if (typeof window === 'undefined') return;
  if ((window as any).netlifyIdentity && typeof (window as any).netlifyIdentity.open === 'function') {
    return (window as any).netlifyIdentity.open();
  }
  // If no widget, attempt to import client lib (no UI)
  try {
    const mod = await import('@netlify/identity');
    // fallback: nothing to open
    return null;
  } catch (e) {
    return null;
  }
}

export default { getUser, logout, openWidget };
