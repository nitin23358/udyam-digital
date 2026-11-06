import { Wifi, Radio, Smartphone, ShieldCheck, Cloud, MessageCircle, Phone, Camera, Cpu, Truck, Globe, Server, Network, Receipt, HardDrive, Mail, Router, MessageSquareText, PhoneCall } from 'lucide-react';

export const PRODUCT_ICON = {
  P01: Wifi, P02: Wifi, P03: Wifi, P04: Radio, P05: Network, P06: Network, P07: Smartphone, P08: Smartphone,
  P09: Router, P10: Network, P11: Server, P12: PhoneCall, P13: Phone, P14: MessageSquareText, P15: MessageCircle,
  P16: Mail, P17: HardDrive, P18: Globe, P19: Receipt, P20: ShieldCheck, P21: ShieldCheck, P22: Wifi, P23: Camera,
  P24: Cpu, P25: Truck,
};
export const UNIT_LABEL = {
  'per site': ['site', 'sites'], 'per line': ['line', 'lines'], 'per IP': ['IP', 'IPs'], 'per channel': ['channel', 'channels'],
  'per number': ['number', 'numbers'], 'per pack': ['pack', 'packs'], 'per account': ['account', 'accounts'], 'per user': ['user', 'users'],
  'per counter': ['counter', 'counters'], 'per device': ['device', 'devices'], 'per camera': ['camera', 'cameras'], 'per vehicle': ['vehicle', 'vehicles'],
};
export const unitWord = (unit, n) => {
  const u = UNIT_LABEL[unit] || ['unit', 'units'];
  return n === 1 ? u[0] : u[1];
};
export const LINK_IDS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'];
