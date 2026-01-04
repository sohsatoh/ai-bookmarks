/**
 * パスキー関連のユーティリティ関数
 */

/**
 * AAGUIDから認証器名へのマッピング
 * 参考: https://github.com/passkeydeveloper/passkey-authenticator-aaguids
 */
const AAGUID_MAPPING: Record<string, string> = {
  // Apple
  "00000000-0000-0000-0000-000000000000": "Touch ID または Face ID",
  "adce0002-35bc-c60a-648b-0b25f1f05503": "Chrome on Mac",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",

  // YubiKey
  "2fc0579f-8113-47ea-b116-bb5a8db9202a": "YubiKey 5 Series",
  "f8a011f3-8c0a-4d15-8006-17111f9edc7d": "YubiKey 5 FIPS Series",
  "cb69481e-8ff7-4039-93ec-0a2729a154a8": "YubiKey 5Ci",
  "ee882879-721c-4913-9775-3dfcce97072a": "YubiKey 5 NFC",
  "fa2b99dc-9e39-4257-8f92-4a30d23c4118": "YubiKey 5Ci FIPS",
  "73bb0cd4-e502-49b8-9c6f-b59445bf720b": "YubiKey 5 NFC FIPS",
  "c1f9a0bc-1dd2-404a-b27f-8e29047a43fd": "YubiKey 5 Bio",
  "85203421-48f9-4355-9bc8-8a53846e5083": "YubiKey Bio",

  // Google
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager",
  "adce0002-35bc-c60a-648b-0b25f1f05503": "Chrome Browser",

  // Android
  "90a3ccdf-635c-4729-a248-9b709135078f": "Android Platform Authenticator",

  // Titan
  "ee041bce-25e5-4cdb-8f86-897fd6418464": "Titan Security Key",

  // Other popular authenticators
  "6d44ba9b-f6ec-2e49-b930-0c8fe920cb73": "SoloKeys",
  "3789da91-f943-46bc-95c3-50ea2012f03a": "Feitian ePass FIDO",
};

/**
 * AAGUIDから認証器名を取得
 * @param aaguid - AAGUID文字列（ハイフン区切り）
 * @returns 認証器名、見つからない場合はnull
 */
export function getAuthenticatorName(aaguid: string | null): string | null {
  if (!aaguid) return null;

  const normalizedAaguid = aaguid.toLowerCase();
  return AAGUID_MAPPING[normalizedAaguid] || null;
}

/**
 * デバイスタイプから認証器名を推測
 * @param deviceType - デバイスタイプ（platform/cross-platform）
 * @returns 推測される認証器名
 */
export function getDeviceTypeName(deviceType: string): string {
  if (deviceType === "platform") {
    // プラットフォーム認証器（内蔵）
    if (typeof navigator !== "undefined") {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes("mac")) return "Touch ID または Face ID";
      if (userAgent.includes("win")) return "Windows Hello";
      if (userAgent.includes("android")) return "Android 生体認証";
      if (userAgent.includes("iphone") || userAgent.includes("ipad"))
        return "Face ID または Touch ID";
    }
    return "デバイス内蔵認証器";
  }

  // クロスプラットフォーム認証器（セキュリティキー等）
  return "セキュリティキー";
}

/**
 * パスキーの表示名を生成
 * @param passkey - パスキー情報
 * @param existingNames - 既存のパスキー名のリスト（重複回避用）
 * @returns 表示名
 */
export function generatePasskeyDisplayName(
  passkey: {
    aaguid: string | null;
    deviceType: string;
    name?: string | null;
  },
  existingNames: string[] = []
): string {
  // 既に名前が設定されている場合はそれを使用
  if (passkey.name) return passkey.name;

  // AAGUIDから認証器名を取得
  const authenticatorName = getAuthenticatorName(passkey.aaguid);
  if (authenticatorName) {
    // 重複がある場合は番号を付ける
    let displayName = authenticatorName;
    let counter = 1;
    while (existingNames.includes(displayName)) {
      counter++;
      displayName = `${authenticatorName} (${counter})`;
    }
    return displayName;
  }

  // AAGUIDから取得できない場合はデバイスタイプから推測
  const deviceTypeName = getDeviceTypeName(passkey.deviceType);
  let displayName = deviceTypeName;
  let counter = 1;
  while (existingNames.includes(displayName)) {
    counter++;
    displayName = `${deviceTypeName} (${counter})`;
  }
  return displayName;
}
