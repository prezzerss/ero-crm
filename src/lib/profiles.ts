export type StaffProfile = {
  access: string;
  email: string;
  imageSrc?: string;
  name: string;
  signIn: string;
  status: string;
};

const domain = "@easy-read-online.co.uk";

export const staffProfiles: StaffProfile[] = [
  {
    name: "Becky",
    email: `becky${domain}`,
    imageSrc: "/becky.png",
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  },
  {
    name: "Cara",
    email: `cara${domain}`,
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  },
  {
    name: "Danielle",
    email: `danielle${domain}`,
    imageSrc: "/danielle.png",
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  },
  {
    name: "Jack",
    email: `jack${domain}`,
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  },
  {
    name: "Karen",
    email: `karen${domain}`,
    imageSrc: "/karen.png",
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  },
  {
    name: "Kelvin",
    email: `kelvin${domain}`,
    imageSrc: "/kelvin.png",
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  },
  {
    name: "Lewis",
    email: `lewis${domain}`,
    imageSrc: "/lewis.png",
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  },
  {
    name: "Megan",
    email: `megan${domain}`,
    imageSrc: "/megan.png",
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  },
  {
    name: "Presley",
    email: `presley${domain}`,
    imageSrc: "/pres-cold.png",
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  },
];

function titleCase(value: string) {
  return value
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function getInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return initials || "ER";
}

export function getStaffProfileByEmail(email: string) {
  const normalisedEmail = email.trim().toLowerCase();

  return staffProfiles.find((profile) => profile.email === normalisedEmail);
}

export function buildFallbackProfile(email: string): StaffProfile {
  const normalisedEmail = email.trim().toLowerCase();
  const localPart = normalisedEmail.split("@")[0] || "CRM user";

  return {
    name: titleCase(localPart),
    email: normalisedEmail,
    status: "Active",
    signIn: "Microsoft SSO",
    access: "CRM user",
  };
}
