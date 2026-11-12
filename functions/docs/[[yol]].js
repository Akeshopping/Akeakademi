// /docs ve altındaki her adres: geliştirme dosyaları web'den sunulmaz (bkz. lib/yol-koruma.js). Her yöntem için 404 + no-store.
import { korumaYaniti } from "../../lib/yol-koruma.js";
export const onRequest = () => korumaYaniti();
