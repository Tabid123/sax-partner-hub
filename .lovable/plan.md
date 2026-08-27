# Kala soocidda Tenant-ka — qeybta hadhay

Waxaan hubiyay xaaladda hadda ee koodhka iyo database-ka. Labadii fix ee yaryar (RotatingBanner + PaymentErrorModal) horeba way saxan yihiin — `currentTenantId` meesha saxda ah ayuu ku jiraa, khaladkii typecheck-ka ma jiro.

Waxa weli isku dhafan (waan xaqiijiyay mid walba):

## 1. Reservation RPC-yada (mudnaanta koowaad)

`create_online_payment_reservation` iyo `create_jumlo_payment_reservation` ma qaadaan `p_tenant_id`. Tenant-ka waxaa lagu qiyaasaa trigger (`derive_pending_payment_tenant`) oo ka soo qaata provider/package/tier. Haddii mid kastaa maqan yahay ama khaladan yahay, waxay ku dhacdaa `resolve_public_tenant()` oo dooranaya tenant-ka `iftin` ama kan ugu da'da weyn — taasi waa dalab tenant kale ku dhacaya.

Fix: labada function `p_tenant_id uuid` ha qaataan, kuna qor `pending_online_payments`. Function-ka gudihiisa la hubiyo in provider/package/tier ay isku tenant yihiin; haddii ay kala duwan yihiin `{ ok: false, error: 'tenant_mismatch' }` la soo celiyo halkii la qiyaasi lahaa. Front-end (`PaymentProviders.tsx`, `JumloFlow.tsx`) tenant-ka hadda jira ayuu dirayaa.

## 2. Boggagga macmiilka ee weli aan tenant lahayn

Kuwan wax filter ah kuma jiro, sidaa awgeed macmiil wuxuu arki karaa xog tenant kale:

- `OrderHistory.tsx` — taariikhda dalabyada telefoon ahaan oo keliya ayay ku raadisaa; ku dar `tenant_id`.
- `Profile.tsx` — `verified_phones` delete iyo `orders` delete waxay tirtiraan dhammaan tenant-yada. Aad u khatar ah; ku xir tenant-ka.
- `useNotifications.ts` / `Notifications.tsx` — ogeysiisyada tenant kasta way is qasayaan.
- `PhoneInput.tsx` iyo `PhoneVerification.tsx` — akhrinta/qorista `verified_phones` tenant ma leh; nambar ka diiwaangashan shirkad kale wuxuu si toos ah u galayaa tan.
- `useOfflineSync.ts` — order-ka offline-ka ah ee la geliyo `tenant_id` ma wato.
- `usePendingIntentSync.ts` — `pending_online_payments` raadinta tenant ma leh.
- `PaymentSuccess.tsx` / `OfflinePhoneInputSheet.tsx` — la hubinayo, la saxayo haddii loo baahdo.

Hab: mid walba `useTenant()` ha isticmaalo, `.eq('tenant_id', currentTenantId)` akhrinta, `tenant_id` qorista, `queryKey` -na tenant ha ku jiro si cache-ku uusan isku dhafan.

## 3. Dhinaca database-ka (RLS)

Sax koodhka kaliya ma filna — RLS ayaa ah darbiga rasmiga ah. Waxaan eegayaa siyaasadaha `verified_phones`, `orders`, `notifications`, `pending_online_payments` si aan u hubiyo in akhrinta anonymous-ka ah ay tenant ku xiran tahay, kadibna migration ku saxaya kuwa furan.

## Faahfaahin farsamo

- Migration 1: labada reservation function dib u qor (`p_tenant_id` + hubinta iswaafajinta), iyo adkaynta RLS ee shaxdaha kor ku xusan.
- Kadib migration-ka la ansixiyo, waxaan cusboonaysiinayaa call-yada front-end iyo boggagga liiska #2 ku jira.
- Waxba lagama beddelayo naqshadda (UI) — kaliya xog kala soocid.
