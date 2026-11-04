import { Link } from 'react-router-dom';

export default function ErrorPage() {
  return (
    <div className="store-landing">
      <h1>ページが見つかりませんでした</h1>
      <p>URLをご確認いただくか、トップページからやり直してください。</p>
      <p>
        <Link to="/">トップへ戻る</Link>
      </p>
    </div>
  );
}
