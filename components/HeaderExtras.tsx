import AuthButton from './AuthButton';
import ThemeToggle from './ThemeToggle';
import XpBadge from './XpBadge';

export default function HeaderExtras() {
  return (
    <>
      <XpBadge />
      <ThemeToggle />
      <AuthButton />
    </>
  );
}
