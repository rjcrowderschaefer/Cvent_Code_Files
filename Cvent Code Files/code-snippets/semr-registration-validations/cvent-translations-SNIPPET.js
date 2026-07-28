// Cvent field guards — TRANSLATIONS snippet (raw JS, no <script> tags).
// Trigger: All Pages. Place alongside the guard-logic snippet (either order).
//
// Draft translations below — have a native speaker review for tone/consistency
// with the rest of your localized form. Any blank/missing string falls back to
// English. KEEP the {n} placeholder in "mx" (replaced with the field's limit).
//
// English source:
//   c1 = "This field accepts English characters only. Special characters and non-Latin alphabets are not supported."
//   c2 = "This field accepts English characters only. Some special characters and all non-Latin alphabets are not supported."
//   u  = "Email address cannot include a \"_\" immediately followed by @"
//   mx = "Only {n} characters are allowed for this field"

window.__ngT = {
  ja: {
    // Japanese (ja-JP)
    c1: "このフィールドでは英語の文字のみ使用できます。特殊文字および非ラテン文字はサポートされていません。",
    c2: "このフィールドでは英語の文字のみ使用できます。一部の特殊文字およびすべての非ラテン文字はサポートされていません。",
    u: "メールアドレスでは、@ の直前に「_」を使用できません。",
    mx: "このフィールドには {n} 文字までしか入力できません。",
    ap: "続行するにはまっすぐなアポストロフィ（'）を使用してください。",
  },
  zh: {
    // Chinese Simplified (zh-CN)
    c1: "此字段仅接受英文字符。不支持特殊字符和非拉丁字母。",
    c2: "此字段仅接受英文字符。不支持部分特殊字符以及所有非拉丁字母。",
    u: "电子邮件地址中，“_”不能紧接在 @ 之前。",
    mx: "此字段最多只能输入 {n} 个字符。",
    ap: "请使用直单引号（'）以继续。",
  },
  pt: {
    // Portuguese (pt-PT)
    c1: "Este campo aceita apenas caracteres ingleses. Não são suportados caracteres especiais nem alfabetos não latinos.",
    c2: "Este campo aceita apenas caracteres ingleses. Não são suportados alguns caracteres especiais nem quaisquer alfabetos não latinos.",
    u: 'O endereço de e-mail não pode incluir um "_" imediatamente seguido de @.',
    mx: "Este campo permite apenas {n} caracteres.",
    ap: "Utilize um apóstrofo reto para continuar.",
  },
  es: {
    // Spanish (es-ES)
    c1: "Este campo solo acepta caracteres en inglés. No se admiten caracteres especiales ni alfabetos no latinos.",
    c2: "Este campo solo acepta caracteres en inglés. No se admiten algunos caracteres especiales ni los alfabetos no latinos.",
    u: 'La dirección de correo electrónico no puede incluir un "_" inmediatamente seguido de @.',
    mx: "Este campo solo permite {n} caracteres.",
    ap: "Utilice un apóstrofo recto para continuar.",
  },
};
