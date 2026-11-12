> **RASCUNHO — requer revisão jurídica / DRAFT — requires legal review**

# Beavo Privacy Policy

**Version:** 2026-11-11 · **Effective:** [PUBLICATION DATE]

This Policy explains how the Beavo app ("Beavo", "we") processes personal data under Brazil's General Data Protection Law (Law No. 13,709/2018, "LGPD"). Beavo helps children aged 4 to 12 build a tooth-brushing habit. **The account always belongs to an adult (a parent or legal guardian). Children never create an account or sign in.** The Portuguese version prevails if the two versions differ.

## 1. Data controller

- **Controller:** [COMPANY NAME], CNPJ [CNPJ], [ADDRESS].
- **Data protection officer (Encarregado):** [DPO NAME] — [DPO EMAIL].
- **Privacy contact:** [CONTACT EMAIL].

## 2. Data we process

### 2.1 Parent account data
- **Name and email**, and a password (stored by Firebase Authentication in protected form; we never see it) if you sign up with email.
- **Your Google account identifier, name and email** if you sign in with Google.
- **App language** and the **date your profile was created**.
- **Your consent record:** which versions of the Terms of Service and this Policy you accepted, and when.

### 2.2 Children's data (entered by you)
- The child's **first name or nickname** (the app asks you not to enter a surname).
- **Birth year**, if you choose to enter it (optional).
- The chosen **avatar** (a character and a color).

### 2.3 Brushing and dental health data (sensitive data)
- **Brushing times** you set up (for example "after lunch", 11:00–15:00).
- **Brushing sessions:** date, start time, duration, and whether the full 2 minutes were completed.
- **Dental records** you add: the tooth (FDI number), whether it is a symptom or a treatment, the category (for example "pain" or "filling"), an optional note, and the date.
- **Categories** for those records (the defaults and any you create).

Brushing and dental records are **health-related data** and therefore **sensitive personal data** (LGPD, art. 5, II).

### 2.4 Data kept only on your device
So the app works offline, your device keeps: your sign-in session, a copy of the children's profiles and brushing times, which child is selected, brushing sessions not yet uploaded, a local record of your consent, and app settings (such as brushing time). The profile copy is deleted when you log out. The backup file created by an export is temporary: it is removed from the app as soon as the share sheet closes (or at the next launch if the app was closed first); the temporary copy of an imported backup is also deleted right after it is read; any copy you save or send is under your control. Pending sessions are uploaded to your account once you're online.

### 2.5 What we do NOT collect
- **No** analytics, crash reporting, advertising or tracking of any kind.
- **No** location, contacts, photos, videos, audio or advertising identifiers.
- We do **not** send your or your children's data to artificial-intelligence services.

### 2.6 Using Beavo without an account
You can use Beavo without creating an account (*Use without an account*). In that case the children's profiles, brushing times, brushing sessions, dental records, categories and the record of your consent are stored **only on your device**. We do not receive them, they are not sent to our servers, and section 5 does not apply to them.

- **Keeping the data is up to you.** It is lost if the app is deleted or the device is reset, lost or replaced, and we cannot recover it. *More → Export backup* creates a copy you can keep.
- **Erasing it:** *More → Erase data on this phone* (asks for a grown-ups-only check) deletes everything immediately.
- **Moving it to an account:** if you later create or sign in to an account on this device, the app shows the names of the profiles kept on the device and asks whether to move them into that account. They are moved only if you confirm, after a grown-ups-only check; they are then removed from the device and treated as account data under this Policy. If you decline, they stay on the device only; the same screen also lets you erase them.

## 3. The camera is only a mirror

During brushing, Beavo can show the front camera image so the child can see themselves, like a mirror. **Nothing is recorded, saved, sent or analyzed.** No photo, video or image frame is captured or processed, on the device or on any server. The app **does not request microphone access**. The camera is on only while the brushing screen is open, and turns off when you leave it or the app goes to the background. The camera is optional: children can brush without it.

## 4. Why we use data, and the legal basis

| Purpose | Data | Legal basis (LGPD) |
|---|---|---|
| Create and maintain your account; sign-in | Account data (2.1) | Performance of a contract (art. 7, V) |
| Record your consent and the versions accepted | Consent record | Compliance with a legal obligation (art. 7, II) |
| Create children's profiles and show brushing progress | Children's data (2.2) and brushing data (2.3) | **Specific and prominent consent from a parent or legal guardian** (art. 14, §1) |
| Store brushing times, sessions and dental records | Dental health data (2.3) | **Specific, highlighted consent for specific purposes** (art. 11, I) |
| Let you export and delete your data | All | Compliance with a legal obligation (art. 18) |

The parent gives consent the first time they use the app, by ticking a box that is **not pre-ticked**, before adding the first child. We ask again whenever this Policy or the Terms change. You can withdraw consent at any time by deleting a child's profile or your account (section 7). Withdrawal does not affect processing done before it.

We process only the data needed for these purposes. We never use children's data for advertising, behavioral profiling or any commercial purpose.

## 5. Where data is stored and who we share it with

- **Google Cloud Firestore** (Google LLC), in Brazil, region **southamerica-east1 (São Paulo)** [CONFIRM the region configured in the Firebase project]: stores the profile, children, brushing times, sessions, dental records and categories.
- **Firebase Authentication** (Google LLC): stores sign-in data (name, email, Google identifier). This service is **not tied to one region** and may process data outside Brazil, mainly in the United States. This **international transfer** relies on [CONFIRM: standard contractual clauses / Google Cloud data processing terms] (LGPD, art. 33).
- **Sign in with Google** (Google LLC): if you choose it, Google confirms your identity to us.
- **Firebase Hosting** (Google LLC): serves these documents' web pages. It receives no app data.

Google acts as our **processor**, following our instructions and the Google Cloud/Firebase data processing terms.

**We do not sell, rent or share personal data** with advertisers or other companies. We disclose data only when required by law or court order.

## 6. How long we keep data

- Data is kept **for as long as your account exists**.
- When you **delete a child's profile**, we immediately delete that profile and its brushing times, sessions and dental records.
- When you **delete your account**, we immediately delete all data stored in your account and your sign-in.
- Google may keep residual copies for a limited time under its own deletion timelines [CONFIRM the applicable period].
- We may keep the consent record for as long as needed to demonstrate LGPD compliance [CONFIRM with counsel whether it must be kept after account deletion; the app currently deletes it with the account].

## 7. Your rights and how to use them in the app

Under the LGPD (art. 18) you may request: confirmation that we process your data, access, correction, anonymization, blocking or deletion of unnecessary data, portability, information about who we share data with, information about the option not to consent, and withdrawal of consent.

In the app:
- **Access and take your data (portability):** *More → Export backup* (asks for a grown-ups-only check). Creates a `.json` file with all data in your account (including your sign-in name and email) and your children's data, which you can save or share through your device's share sheet.
- **Restore a backup:** *More → Import backup* (asks for a grown-ups-only check). You pick a Beavo backup file; its data is checked and merged into your account (items with the same ID are replaced; nothing is deleted).
- **Correct:** for the profile, tap the child switcher at the top right, then *Edit*. For a dental record, tap the tooth on *Overview*, delete the record and add it again.
- **Delete a child:** *Edit profile → Delete profile* (asks for a grown-ups-only check).
- **Without an account (section 2.6):** export and import act on the data kept on your device, and *More → Erase data on this phone* replaces *Delete account*. Erasing that data also withdraws your consent.
- **Delete your account and all data:** *More → Delete account* (asks for a grown-ups-only check and for you to sign in again).

For other requests, email [DPO EMAIL]. We reply within [DEADLINE] days. You may also complain to Brazil's **National Data Protection Authority (ANPD)**.

## 8. Security

Data travels encrypted (HTTPS/TLS). Database security rules let each account read and change only its own data. Sensitive actions in the app (adding or deleting a child, adding or deleting dental records, exporting data, deleting the account) sit behind a grown-ups-only check. No system is 100% secure; if a relevant security incident happens, we will notify you and the ANPD as the LGPD requires.

## 9. Children

Children use Beavo **under an adult's responsibility**. Only the adult creates the account, accepts these documents and adds children. We ask children for no personal data. If you believe a child's data was added without a guardian's authorization, email [DPO EMAIL] and we will delete it.

## 10. Changes to this Policy

When this Policy changes, we update the version at the top and **ask you to read and accept it again in the app** before continuing. Previous versions are available on request.

## 11. Contact

[COMPANY NAME] — [CONTACT EMAIL] — Data protection officer: [DPO NAME], [DPO EMAIL].
