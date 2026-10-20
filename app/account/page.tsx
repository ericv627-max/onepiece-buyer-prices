import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <>
      <header className="page-head"><h1>Account</h1></header>
      <div className="state panel coming">
        <b>You’re browsing as a guest.</b>
        <p>Google sign-in is coming next. Until then your wishlist, currency, name and recent searches are saved in this browser only.</p>
        <button type="button" className="btn" disabled>Sign in with Google · soon</button>
      </div>
    </>
  );
}
