// AKE Akademi · korumalı soru bankası · sunucu taraflı soru oturumu uçları (PR 2/6, "karanlık API")
//   POST /api/soru/oturum   POST /api/soru/cevap   POST /api/soru/bitir   GET /api/soru/ozet
// AKE_SORU_V2=1 (yalnız sunucu ortam değişkeni) yoksa tüm uçlar 404 döner ve D1'e hiç dokunulmaz. Ayrıntı: lib/soru-api.js
import { soruApi } from "../../../lib/soru-api.js";
export const onRequest = ({ request, env, params }) => soruApi(request, env, params);
