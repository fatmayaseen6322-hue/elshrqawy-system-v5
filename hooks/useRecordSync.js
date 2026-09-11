import { useCallback, useEffect, useRef, useState } from "react";
import { lsGet, lsSet } from "../utils";

// ══════════════════════════════════════════════════════════════
// useRecordSync — مزامنة على مستوى "السجل الواحد" بدل "القائمة كلها"
// ──────────────────────────────────────────────────────────────
// المشكلة القديمة: كل نوع بيانات (طلاب/مصاريف/غياب...) كان بيترفع
// كأراي واحد كامل على مستند واحد (elshrqawy_live_state). لو جهازين
// عدّلوا حاجتين مختلفتين تمامًا (حتى لو مش نفس السجل) في نفس الفترة،
// اللي رفع تاني كان بيمسح تعديل اللي رفع الأول من غير أي تنبيه —
// وده سبب اختلاف البيانات بين اللاب توب والفون والأونلاين بمرور الوقت.
//
// الحل هنا: كل سجل (بمعرّفه id) له مستند منفصل في كولكشن خاص بنوعه.
// أي جهاز يعدّل سجل واحد بس، بيرفع السجل ده لوحده — مبيلمسش باقي
// السجلات خالص. الحذف بيتعمل بـ "شاهد" (_deleted: true) بدل ما
// المستند يتمسح فعليًا، عشان الأجهزة التانية تعرف إنه اتحذف مش بس
// مختفي، ولمنع إعادة ظهوره لو جهاز قديم لسه شايله محليًا.
//
// القراءة بتتحصر في "السجلات اللي اتغيّرت بعد آخر مزامنة" بس (query
// بشرط _updatedAt > آخر وقت اتزامن فيه الجهاز ده) — مش الكولكشن كله
// في كل مرة، عشان استهلاك القراءات (reads) في Firestore يفضل قريب
// من الوضع القديم قد الإمكان.
// ══════════════════════════════════════════════════════════════

const DEBOUNCE_MS = 3000;

export function useRecordSync(collectionName, records, setRecords) {
  const snapKey     = `app_recsync_${collectionName}_snapshot`;  // { [id]: JSON آخر نسخة من السجل اترفعت فعليًا
  const lastPullKey = `app_recsync_${collectionName}_last_pull`; // آخر وقت (ms) استلمنا فيه تحديثات من السحابة

  const recordsRef       = useRef(records);
  recordsRef.current = records;
  const isApplyingRemote = useRef(false);
  const pushTimer        = useRef(null);
  const firstRun         = useRef(true);
  const [state, setState] = useState({ status: "idle", message: "" });

  // بيرفع بس السجلات اللي اتغيّرت فعليًا (أو كل حاجة لو force=true)
  const pushChanges = useCallback(async (force = false) => {
    if (!navigator.onLine) return;
    try {
      const { collection, doc, writeBatch } = await import("firebase/firestore");
      const { db } = await import("../src/firebase");

      const current    = recordsRef.current || [];
      const snapshot   = force ? {} : lsGet(snapKey, {});
      const currentMap = {};
      current.forEach(r => { if (r && r.id !== undefined && r.id !== null) currentMap[String(r.id)] = r; });

      const ts = Date.now();
      const batch = writeBatch(db);
      let changed = false;

      // سجلات جديدة أو اتعدّلت محليًا
      for (const id in currentMap) {
        const json = JSON.stringify(currentMap[id]);
        if (force || snapshot[id] !== json) {
          batch.set(doc(db, collectionName, id), { ...currentMap[id], _deleted: false, _updatedAt: ts });
          snapshot[id] = json;
          changed = true;
        }
      }
      // سجلات كانت موجودة في آخر نسخة اترفعت، ودلوقتي مش موجودة محليًا = اتحذفت
      if (!force) {
        for (const id in snapshot) {
          if (!(id in currentMap)) {
            batch.set(doc(db, collectionName, id), { _deleted: true, _updatedAt: ts });
            delete snapshot[id];
            changed = true;
          }
        }
      }

      if (changed) {
        await batch.commit();
        lsSet(snapKey, snapshot);
      }
      setState({ status: "success", message: "متصلة ومتزامنة ✓" });
    } catch (e) {
      setState({ status: "error", message: "تعذّرت مزامنة البيانات (تأكد من النت وصلاحيات Firestore)" });
    }
  }, [collectionName, snapKey]);

  // بيدمج سجلات جايه من السحابة (تعديل أو حذف) جوه القائمة المحلية
  const applyRemoteDocs = useCallback((docs) => {
    if (!docs.length) return;
    isApplyingRemote.current = true;
    const snapshot = lsGet(snapKey, {});
    let maxTs = lsGet(lastPullKey, 0);
    setRecords(prev => {
      const map = {};
      (prev || []).forEach(r => { if (r && r.id !== undefined && r.id !== null) map[String(r.id)] = r; });
      docs.forEach(d => {
        const data = d.data();
        const id = d.id;
        if (data._updatedAt && data._updatedAt > maxTs) maxTs = data._updatedAt;
        if (data._deleted) {
          delete map[id];
          delete snapshot[id];
        } else {
          const { _deleted, _updatedAt, ...rest } = data;
          const rec = { ...rest, id: rest.id !== undefined ? rest.id : id };
          map[id] = rec;
          snapshot[id] = JSON.stringify(rec);
        }
      });
      lsSet(snapKey, snapshot);
      return Object.values(map);
    });
    lsSet(lastPullKey, maxTs);
    setState({ status: "success", message: "تم تحديث البيانات من جهاز تاني تلقائيًا ✓" });
  }, [setRecords, snapKey, lastPullKey]);

  // التحميل الأول + الاستماع اللحظي (onSnapshot) لأي تغيير جديد بس
  useEffect(() => {
    let unsub = null;
    let cancelled = false;
    (async () => {
      try {
        const { collection, getDocs, onSnapshot, query, where } = await import("firebase/firestore");
        const { db } = await import("../src/firebase");
        const lastPull = lsGet(lastPullKey, 0);
        let listenFrom = lastPull;

        if (lastPull === 0) {
          // أول مرة للجهاز ده مع الكولكشن ده: هات كل حاجة مرة واحدة بس
          const snap = await getDocs(collection(db, collectionName));
          if (cancelled) return;
          if (snap.empty) {
            // الكولكشن لسه فاضي على السحابة (أول تفعيل للنظام الجديد) —
            // ارفع نسخة الجهاز ده المحلية عشان "تزرع" البيانات الأولى.
            await pushChanges(true);
          } else {
            applyRemoteDocs(snap.docs);
          }
          listenFrom = Date.now();
          lsSet(lastPullKey, listenFrom);
        }

        if (cancelled) return;
        unsub = onSnapshot(
          query(collection(db, collectionName), where("_updatedAt", ">", listenFrom)),
          snap => {
            const changedDocs = snap.docChanges().map(c => c.doc);
            if (changedDocs.length) applyRemoteDocs(changedDocs);
            else setState(s => (s.status === "idle" ? { status: "success", message: "متصلة ومتزامنة ✓" } : s));
          },
          () => setState({ status: "error", message: "تعذّرت المزامنة اللحظية (تأكد من صلاحيات Firestore والنت)" })
        );
      } catch (e) {
        setState({ status: "error", message: "تعذّر تفعيل المزامنة" });
      }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // أي تغيير محلي حقيقي (مش جاي من السحابة نفسها) → ارفعه بعد 3 ثواني هدوء
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (isApplyingRemote.current) { isApplyingRemote.current = false; return; }
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => pushChanges(false), DEBOUNCE_MS);
    return () => clearTimeout(pushTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  // لما النت يرجع بعد انقطاع — ادفع أي تعديل عالق فورًا
  useEffect(() => {
    const onOnline = () => pushChanges(false);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [pushChanges]);

  const forcePush = useCallback(() => pushChanges(true), [pushChanges]);

  return { state, forcePush };
}
