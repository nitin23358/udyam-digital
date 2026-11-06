// Advisor copy in English and Hindi. Other languages are produced by the LLM when a key is set.
export const LANGS = {
  en: { label: 'English', native: 'English', builtIn: true },
  hi: { label: 'Hindi', native: 'हिन्दी', builtIn: true },
  mr: { label: 'Marathi', native: 'मराठी' },
  ta: { label: 'Tamil', native: 'தமிழ்' },
  te: { label: 'Telugu', native: 'తెలుగు' },
  kn: { label: 'Kannada', native: 'ಕನ್ನಡ' },
  bn: { label: 'Bengali', native: 'বাংলা' },
  gu: { label: 'Gujarati', native: 'ગુજરાતી' },
};

export const COPY = {
  en: {
    greet: "Namaste! I'm your Accel Business advisor. Tell me a little about your business and I'll put together the right internet, phone and digital tools — with one clear monthly price.",
    q_businessType: 'What kind of business do you run? Describe it in your own words — e.g. “pharmacy in Pune with 3 staff”.',
    q_segment: 'Which of these is closest to your business?',
    q_city: 'Which city is your business in?',
    q_employees: 'How many people work there, including you?',
    q_sites: 'How many locations do you run — shops, branches, clinics or units?',
    q_currentInternet: 'What do you use for internet today?',
    q_needs: 'What should your new setup help you with? Pick everything that applies.',
    q_gstin: 'Last one: do you have a GSTIN? With it I can verify your business instantly and unlock services like WhatsApp Business and SMS.',
    ack_prefix: 'Got it',
    ready: "Thanks — that's everything I need. Here's what I'd recommend.",
    gst_found: 'Found it in the GST registry: {name}, {city}. Status: {status}.',
    gst_inactive: 'The registry shows this GSTIN as {status}. I’ll leave out services that need an active GSTIN — you can still get connected today.',
    gst_notfound: "I couldn't find {gstin} in the registry. Please check the number — or continue without it for now.",
    gst_invalid: "That doesn't look like a valid GSTIN ({why}). Please check it — or continue without it.",
    gst_skip: 'No problem — you can go ahead without a GSTIN. A few services need one, and I’ll mark those clearly.',
    city_unknown: "We'll confirm we can serve {city} during verification.",
    chips_done: 'Done',
    chip_no_gstin: "I don't have one",
    chip_later: "I'll add it later",
    something_else: 'Something else',
    didnt_get: "Sorry, I didn't quite catch that — you can tap one of the options or say it another way.",
  },
  hi: {
    greet: 'नमस्ते! मैं आपका Accel Business सलाहकार हूँ। अपने व्यवसाय के बारे में थोड़ा बताइए — मैं सही इंटरनेट, फ़ोन और डिजिटल सेवाएँ एक साफ़ मासिक कीमत के साथ सुझाऊँगा।',
    q_businessType: 'आपका व्यवसाय क्या है? अपने शब्दों में बताइए — जैसे “पुणे में दवा की दुकान, 3 लोग काम करते हैं”।',
    q_segment: 'इनमें से आपका व्यवसाय किसके सबसे क़रीब है?',
    q_city: 'आपका व्यवसाय किस शहर में है?',
    q_employees: 'आपको मिलाकर वहाँ कितने लोग काम करते हैं?',
    q_sites: 'आपकी कितनी लोकेशन हैं — दुकानें, शाखाएँ, क्लिनिक या यूनिट?',
    q_currentInternet: 'अभी आप इंटरनेट के लिए क्या इस्तेमाल करते हैं?',
    q_needs: 'नई सेवाओं से आपको किन कामों में मदद चाहिए? जो भी लागू हो, चुनिए।',
    q_gstin: 'आख़िरी सवाल: क्या आपके पास GSTIN है? इससे मैं आपका व्यवसाय तुरंत सत्यापित कर सकता हूँ और WhatsApp Business, SMS जैसी सेवाएँ खुल जाती हैं।',
    ack_prefix: 'समझ गया',
    ready: 'धन्यवाद — मुझे जो चाहिए था, सब मिल गया। यह रहा मेरा सुझाव।',
    gst_found: 'GST रजिस्ट्री में मिल गया: {name}, {city}। स्थिति: {status}।',
    gst_inactive: 'रजिस्ट्री में यह GSTIN {status} दिख रहा है। जिन सेवाओं के लिए सक्रिय GSTIN चाहिए, उन्हें मैं हटा दूँगा — बाक़ी सेवाएँ आज ही मिल सकती हैं।',
    gst_notfound: '{gstin} रजिस्ट्री में नहीं मिला। कृपया नंबर जाँचें — या अभी इसके बिना आगे बढ़ें।',
    gst_invalid: 'यह GSTIN सही नहीं लग रहा ({why})। कृपया जाँचें — या इसके बिना आगे बढ़ें।',
    gst_skip: 'कोई बात नहीं — आप GSTIN के बिना भी आगे बढ़ सकते हैं। कुछ सेवाओं के लिए यह ज़रूरी है, उन्हें मैं साफ़ दिखा दूँगा।',
    city_unknown: '{city} में सेवा की पुष्टि हम सत्यापन के दौरान करेंगे।',
    chips_done: 'हो गया',
    chip_no_gstin: 'मेरे पास नहीं है',
    chip_later: 'बाद में दूँगा',
    something_else: 'कुछ और',
    didnt_get: 'माफ़ कीजिए, मैं ठीक से समझ नहीं पाया — नीचे दिए विकल्पों में से चुनिए या दूसरे शब्दों में बताइए।',
  },
};

export const CHIPS = {
  businessType: {
    en: ['Kirana store', 'Pharmacy', 'Salon', 'Dental clinic', 'CA firm', 'Coaching centre', 'Restaurant chain', 'Textile unit'],
    hi: ['किराना दुकान', 'दवा की दुकान', 'सैलून', 'डेंटल क्लिनिक', 'CA फर्म', 'कोचिंग सेंटर', 'रेस्टोरेंट (कई शाखाएँ)', 'कपड़ा यूनिट'],
    values: ['Kirana store', 'Pharmacy', 'Salon', 'Dental clinic', 'CA firm', 'Coaching centre', 'Restaurant chain', 'Textile unit'],
  },
  segment: {
    en: ['Shop or local service', 'Office, clinic or classes', 'Several outlets or branches', 'Factory or workshop'],
    hi: ['दुकान या स्थानीय सेवा', 'ऑफिस, क्लिनिक या कोचिंग', 'कई आउटलेट या शाखाएँ', 'फैक्ट्री या वर्कशॉप'],
    values: ['micro', 'prof', 'multi', 'mfg'],
  },
  city: {
    en: ['Delhi', 'Mumbai', 'Bengaluru', 'Pune', 'Hyderabad', 'Jaipur', 'Lucknow', 'Indore'],
    hi: ['दिल्ली', 'मुंबई', 'बेंगलुरु', 'पुणे', 'हैदराबाद', 'जयपुर', 'लखनऊ', 'इंदौर'],
    values: ['Delhi', 'Mumbai', 'Bengaluru', 'Pune', 'Hyderabad', 'Jaipur', 'Lucknow', 'Indore'],
  },
  employees: {
    en: ['Just me', '2–5', '6–15', '16–50', '50+'],
    hi: ['सिर्फ़ मैं', '2–5', '6–15', '16–50', '50+'],
    values: [1, 3, 10, 25, 60],
  },
  sites: {
    en: ['1', '2', '3–5', '6–10', 'More than 10'],
    hi: ['1', '2', '3–5', '6–10', '10 से ज़्यादा'],
    values: [1, 2, 4, 8, 12],
  },
  currentInternet: {
    en: ['Phone hotspot', 'Home broadband', 'Business broadband', 'Leased line', 'Different ISP at each site', 'Nothing yet'],
    hi: ['फ़ोन हॉटस्पॉट', 'घर का ब्रॉडबैंड', 'बिज़नेस ब्रॉडबैंड', 'लीज़्ड लाइन', 'हर लोकेशन पर अलग', 'अभी कुछ नहीं'],
    values: ['Mobile hotspot', 'Home broadband', 'Business broadband', 'Leased line', 'Mixed per site', 'None'],
  },
};

export const NEEDS_BY_SEGMENT = {
  micro: ['payments', 'whatsapp', 'cctv', 'guestwifi', 'website', 'sms', 'uptime'],
  prof: ['email', 'security', 'backup', 'calls', 'website', 'whatsapp', 'uptime', 'remote', 'cctv'],
  multi: ['payments', 'cctv', 'uptime', 'central', 'whatsapp', 'tollfree', 'guestwifi', 'email', 'fleet'],
  mfg: ['email', 'security', 'cctv', 'machines', 'remote', 'uptime', 'fleet', 'calls'],
};

export const fill = (s, params = {}) => s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
