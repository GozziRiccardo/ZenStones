import * as React from 'react';
import App from '../App';
import { Protected } from '../auth/Protected';

export default function PlayPage() {
  return (
    <Protected>
      <App />
    </Protected>
  );
}
