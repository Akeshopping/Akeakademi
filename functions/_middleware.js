// Tüm Function-yönlendirilen isteklerde (bkz. _routes.json) korunan yolları 404 + no-store ile kapatır; diğerlerini olduğu gibi geçirir.
// Neden klasör rotaları yetmez: statik sunucu "//fabrika/..", "/%66abrika/..", "/fabrika//.." gibi biçimleri çözüp dosyayı sunuyor.
import { korunanMi, korumaYaniti } from "../lib/yol-koruma.js";
export const onRequest = ({ request, next }) => (korunanMi(new URL(request.url).pathname) ? korumaYaniti() : next());
