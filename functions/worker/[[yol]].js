// /worker ve altındaki her adres: Soru Fabrikası Worker kaynakları/ayarları web'den sunulmaz (bkz. lib/yol-koruma.js). Her yöntem için 404 + no-store.
import { korumaYaniti } from "../../lib/yol-koruma.js";
export const onRequest = () => korumaYaniti();
