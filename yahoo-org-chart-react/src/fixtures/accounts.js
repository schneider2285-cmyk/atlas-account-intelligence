export const seedAccounts = [
  {
    id: "acct-atlas-01",
    name: "Northstar Financial",
    industry: "FinTech",
    segment: "Enterprise",
    owner: "A. Patel",
    stage: "Discovery",
    arrPotential: 420000,
    employeeCount: 1800,
    website: "northstar.example.com"
  },
  {
    id: "acct-atlas-02",
    name: "Helio Health Systems",
    industry: "Healthcare",
    segment: "Mid-Market",
    owner: "J. Rivera",
    stage: "Technical Validation",
    arrPotential: 285000,
    employeeCount: 920,
    website: "heliohealth.example.com"
  },
  {
    id: "acct-atlas-03",
    name: "VectorGrid Manufacturing",
    industry: "Industrial",
    segment: "Enterprise",
    owner: "M. Chen",
    stage: "Proposal",
    arrPotential: 510000,
    employeeCount: 2600,
    website: "vectorgrid.example.com"
  },
  {
    id: "acct-atlas-04",
    name: "Nimbus Commerce",
    industry: "Retail Tech",
    segment: "Growth",
    owner: "K. Thomas",
    stage: "Evaluation",
    arrPotential: 195000,
    employeeCount: 540,
    website: "nimbuscommerce.example.com"
  },
  {
    id: "acct-atlas-05",
    name: "Crescent Cyber Defense",
    industry: "Cybersecurity",
    segment: "Enterprise",
    owner: "S. Lewis",
    stage: "Negotiation",
    arrPotential: 640000,
    employeeCount: 1400,
    website: "crescentcyber.example.com"
  }
];

export const seedContacts = [
  {
    id: "c-101",
    accountId: "acct-atlas-01",
    name: "Mina Ochoa",
    title: "VP Revenue Operations",
    function: "RevOps",
    influence: "high"
  },
  {
    id: "c-102",
    accountId: "acct-atlas-01",
    name: "James Lu",
    title: "Director, Sales Enablement",
    function: "Enablement",
    influence: "medium"
  },
  {
    id: "c-201",
    accountId: "acct-atlas-02",
    name: "Tariq Bryant",
    title: "Chief Information Officer",
    function: "IT",
    influence: "high"
  },
  {
    id: "c-202",
    accountId: "acct-atlas-02",
    name: "Elena Frost",
    title: "VP Clinical Systems",
    function: "Clinical Ops",
    influence: "medium"
  },
  {
    id: "c-301",
    accountId: "acct-atlas-03",
    name: "Ravi Anand",
    title: "SVP Manufacturing Operations",
    function: "Operations",
    influence: "high"
  },
  {
    id: "c-302",
    accountId: "acct-atlas-03",
    name: "Nadia Hart",
    title: "Director, IT Security",
    function: "Security",
    influence: "medium"
  },
  {
    id: "c-401",
    accountId: "acct-atlas-04",
    name: "Luca Duran",
    title: "Head of GTM Systems",
    function: "GTM Systems",
    influence: "high"
  },
  {
    id: "c-402",
    accountId: "acct-atlas-04",
    name: "Bria Kim",
    title: "Senior Revenue Analyst",
    function: "Finance",
    influence: "low"
  },
  {
    id: "c-501",
    accountId: "acct-atlas-05",
    name: "Margo Flynn",
    title: "Chief Revenue Officer",
    function: "Executive",
    influence: "high"
  },
  {
    id: "c-502",
    accountId: "acct-atlas-05",
    name: "Devon Ng",
    title: "VP Security Programs",
    function: "Security",
    influence: "high"
  }
];

export const seedOrgCharts = {
  "acct-atlas-01": {
    id: "root-01",
    name: "Mina Ochoa",
    title: "VP Revenue Operations",
    department: "RevOps",
    children: [
      {
        id: "root-01-1",
        name: "James Lu",
        title: "Director, Sales Enablement",
        department: "Enablement",
        children: [
          {
            id: "root-01-1-1",
            name: "Paige Dalton",
            title: "Enablement Manager",
            department: "Enablement"
          }
        ]
      },
      {
        id: "root-01-2",
        name: "Helen Carr",
        title: "Director, Revenue Analytics",
        department: "RevOps"
      }
    ]
  },
  "acct-atlas-02": {
    id: "root-02",
    name: "Tariq Bryant",
    title: "Chief Information Officer",
    department: "IT",
    children: [
      {
        id: "root-02-1",
        name: "Elena Frost",
        title: "VP Clinical Systems",
        department: "Clinical Ops"
      },
      {
        id: "root-02-2",
        name: "Nolan Vega",
        title: "Director, Infrastructure",
        department: "IT"
      }
    ]
  },
  "acct-atlas-03": {
    id: "root-03",
    name: "Ravi Anand",
    title: "SVP Manufacturing Operations",
    department: "Operations",
    children: [
      {
        id: "root-03-1",
        name: "Nadia Hart",
        title: "Director, IT Security",
        department: "Security"
      },
      {
        id: "root-03-2",
        name: "Iris Cole",
        title: "Director, Plant Systems",
        department: "Operations"
      }
    ]
  },
  "acct-atlas-04": {
    id: "root-04",
    name: "Luca Duran",
    title: "Head of GTM Systems",
    department: "GTM Systems",
    children: [
      {
        id: "root-04-1",
        name: "Bria Kim",
        title: "Senior Revenue Analyst",
        department: "Finance"
      }
    ]
  },
  "acct-atlas-05": {
    id: "root-05",
    name: "Margo Flynn",
    title: "Chief Revenue Officer",
    department: "Executive",
    children: [
      {
        id: "root-05-1",
        name: "Devon Ng",
        title: "VP Security Programs",
        department: "Security"
      },
      {
        id: "root-05-2",
        name: "Casey North",
        title: "Director, Revenue Technology",
        department: "Revenue"
      }
    ]
  }
};
