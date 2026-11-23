import type { Metadata } from 'next';
import RegisterForm from './register-form';

export const metadata: Metadata = { title: 'Create Account' };

export default function Page() {
  return <RegisterForm />;
}
