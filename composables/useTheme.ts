export function useTheme() {
  const theme = useCookie<'dark' | 'light'>('theme', {
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

  const setTheme = (value: boolean) => {
    theme.value = value ? 'dark' : 'light';
  };

  const toggleTheme = () => {
    setTheme(!isDark.value);
  };

  return {
    isDark,
    setTheme,
    toggleTheme,
  };
}
