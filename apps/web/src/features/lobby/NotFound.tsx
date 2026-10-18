import { Link } from 'react-router-dom';
import { Logo } from '../../assets/covers';

export function NotFound() {
  return (
    <main className="page center-page">
      <Logo size={72} />
      <h1>Không tìm thấy trang</h1>
      <p className="muted">Trang bạn tìm không tồn tại hoặc game chưa được mở.</p>
      <Link className="btn btn-primary" to="/">
        Về trang chủ
      </Link>
    </main>
  );
}
