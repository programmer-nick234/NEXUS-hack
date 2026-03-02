export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black bg-gradient-to-br from-indigo-950/20 via-black to-purple-950/20">
      <div className="w-full max-w-md px-6">{children}</div>
    </div>
  );
}
