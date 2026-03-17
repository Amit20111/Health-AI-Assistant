import './globals.css';

export const metadata = {
  title: 'Healthy Grocery Assistant — AI Chatbot',
  description:
    'AI-powered Healthy Grocery Assistant — get personalized diet recommendations, meal plans, and nutrition advice.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥗</text></svg>",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
