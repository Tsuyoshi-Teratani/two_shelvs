/** Firebaseのエラーを、原因の見当がつく日本語メッセージに変換する（画面表示用） */
export function describeFirebaseError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const message = (e as { message?: string })?.message ?? String(e);

  if (code === 'permission-denied') {
    return 'Firestoreのルールで読み取りが拒否されました。同梱の firestore.rules をFirebaseコンソールのFirestore「ルール」に貼り付けて公開してください。';
  }
  if (code === 'unavailable' || /offline/i.test(message)) {
    return 'Firestoreに接続できません。Firestore Databaseが作成されているか、.env のプロジェクトID等が正しいか、広告ブロッカーやネットワークが通信を止めていないかを確認してください。';
  }
  if (code === 'failed-precondition') {
    return 'Firestoreのインデックスが必要です。ブラウザのコンソール(F12)に表示されるリンクから作成してください。';
  }
  if (code === 'not-found') {
    return 'Firestore Databaseが見つかりません。FirebaseコンソールでFirestore Databaseを作成してください。';
  }
  return `読み込みに失敗しました（${code || 'unknown'}）。ブラウザのコンソール(F12)のエラーを確認してください。`;
}
