export function useTheme() {
  const theme = useCookie<'dark' | 'light' | null>('theme', {
    default: () => 'light',
    sameSite: 'lax',
    path: '/',
  });

  const isDark = computed({
    get: () => theme.value === 'dark',
    set: (value: boolean) => {
      theme.value = value ? 'dark' : 'light';
    },
  });

  const applyTheme = (value: boolean) => {
    if (!import.meta.client) return;

    document.documentElement.classList.toggle('dark', value);
    document.documentElement.dataset.theme = value ? 'dark' : 'light';
  };

  const setTheme = (value: boolean) => {
    theme.value = value ? 'dark' : 'light';
    applyTheme(value);
  };

  const toggleTheme = () => {
    isDark.value = !isDark.value;
  };

  return {
    isDark,
    setTheme,
    toggleTheme,
  };
}
