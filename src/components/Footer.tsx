export default function Footer() {
  return (
    <footer className="site-footer">
      <span>&copy; {new Date().getFullYear()} ThoShelfsShop</span>
      {/* 専用のお問い合わせページが無いため暫定でmailtoにしています。必要に応じてフォームページに差し替えてください */}
      <a href="mailto:contact@example.com">お問い合わせ</a>
    </footer>
  );
}
