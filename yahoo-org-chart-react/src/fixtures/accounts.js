export const seedAccounts = [
  {
    id: "acct-yahoo",
    name: "Yahoo",
    industry: "Media & Technology",
    segment: "Enterprise",
    owner: "Atlas Team",
    stage: "Signal Monitoring",
    arrPotential: 900000,
    employeeCount: 12000,
    website: "yahoo.com"
  },
  {
    id: "acct-fico",
    name: "FICO",
    industry: "Financial Software",
    segment: "Enterprise",
    owner: "Atlas Team",
    stage: "Intelligence Build",
    arrPotential: 700000,
    employeeCount: 4000,
    website: "fico.com"
  },
  {
    id: "acct-schneider-electric",
    name: "Schneider Electric",
    industry: "Industrial Technology",
    segment: "Enterprise",
    owner: "Atlas Team",
    stage: "Executive Mapping",
    arrPotential: 850000,
    employeeCount: 150000,
    website: "se.com"
  }
];

export const seedContacts = [
  {
    id: "y-101",
    accountId: "acct-yahoo",
    name: "Platform Strategy Lead",
    title: "VP Product Strategy",
    function: "Product",
    influence: "high"
  },
  {
    id: "y-102",
    accountId: "acct-yahoo",
    name: "Revenue Systems Leader",
    title: "Director, Revenue Operations",
    function: "RevOps",
    influence: "medium"
  },
  {
    id: "f-201",
    accountId: "acct-fico",
    name: "Decisioning Portfolio Lead",
    title: "SVP Decision Platforms",
    function: "Product",
    influence: "high"
  },
  {
    id: "f-202",
    accountId: "acct-fico",
    name: "Go-to-Market Programs Leader",
    title: "VP GTM Programs",
    function: "GTM",
    influence: "medium"
  },
  {
    id: "s-301",
    accountId: "acct-schneider-electric",
    name: "Digital Transformation Sponsor",
    title: "EVP Digital Transformation",
    function: "Executive",
    influence: "high"
  },
  {
    id: "s-302",
    accountId: "acct-schneider-electric",
    name: "Global Partnerships Director",
    title: "Director, Strategic Partnerships",
    function: "Partnerships",
    influence: "medium"
  }
];

export const seedOrgCharts = {
  "acct-yahoo": {
    id: "y-root",
    name: "Platform Strategy Lead",
    title: "VP Product Strategy",
    department: "Product",
    children: [
      {
        id: "y-root-1",
        name: "Revenue Systems Leader",
        title: "Director, Revenue Operations",
        department: "RevOps"
      },
      {
        id: "y-root-2",
        name: "Audience Growth Leader",
        title: "Head of Audience Growth",
        department: "Growth"
      }
    ]
  },
  "acct-fico": {
    id: "f-root",
    name: "Decisioning Portfolio Lead",
    title: "SVP Decision Platforms",
    department: "Product",
    children: [
      {
        id: "f-root-1",
        name: "Go-to-Market Programs Leader",
        title: "VP GTM Programs",
        department: "GTM"
      },
      {
        id: "f-root-2",
        name: "Risk Solutions Architect",
        title: "Director, Risk Solutions",
        department: "Solutions"
      }
    ]
  },
  "acct-schneider-electric": {
    id: "s-root",
    name: "Digital Transformation Sponsor",
    title: "EVP Digital Transformation",
    department: "Executive",
    children: [
      {
        id: "s-root-1",
        name: "Global Partnerships Director",
        title: "Director, Strategic Partnerships",
        department: "Partnerships"
      },
      {
        id: "s-root-2",
        name: "Energy Automation Lead",
        title: "VP Energy Automation",
        department: "Automation"
      }
    ]
  }
};
