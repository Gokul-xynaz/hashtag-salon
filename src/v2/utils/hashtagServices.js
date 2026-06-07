export const HASHTAG_SERVICES = {
    Men: {
        "Haircut & Grooming": [
            { name: "Haircut", price: 250, duration: 30 },
            { name: "Beard Shape Up", price: 150, duration: 15 },
            { name: "Shave", price: 150, duration: 15 },
            { name: "Head Oil Massage", price: 500, duration: 30 },
            { name: "Head Massage (Traditional)", price: 600, duration: 30 }
        ],
        "Hair Color": [
            { name: "Mens Color (Basic)", price: 500, duration: 45 },
            { name: "Mens Color (Matrix)", price: 800, duration: 45 },
            { name: "Mens Color (Advanced)", price: 1250, duration: 60 },
            { name: "Mens Color (Cap Highlights)", price: 1250, duration: 60 },
            { name: "Hair Color (Per Streak)", price: 250, duration: 30 }
        ],
        "Hair Spa": [
            { name: "Deep Conditioning Spa (Men's)", price: 500, duration: 45 },
            { name: "Hairspa Men's Dandruff Treatment (Basic)", price: 1000, duration: 60 },
            { name: "Hairspa Men's (Advanced)", price: 2500, duration: 90 },
            { name: "Hairspa Men's Advanced Dandruff Treatment", price: 2500, duration: 90 }
        ],
        "Facial & Skin Care": [
            { name: "D-Tan", price: 500, duration: 30 },
            { name: "D-Tan (Advanced)", price: 1000, duration: 45 },
            { name: "Basic Cleanup", price: 800, duration: 45 },
            { name: "Basic Facial", price: 1000, duration: 60 },
            { name: "Fruit Facial", price: 1500, duration: 60 },
            { name: "Wine Facial", price: 1500, duration: 60 },
            { name: "Whitening Facial", price: 1500, duration: 60 },
            { name: "Skin Lightening Facial (Basic)", price: 1750, duration: 60 },
            { name: "Skin Lightening Facial", price: 2500, duration: 90 },
            { name: "Deep D-Tan Facial (Advanced)", price: 3000, duration: 90 },
            { name: "Brightening & Whitening Facial (Advanced)", price: 4000, duration: 90 },
            { name: "Glow On Facial (Advanced)", price: 6000, duration: 120 }
        ],
        "Grooming Packages": [
            {
                name: "Essential Grooming Package",
                price: 599,
                duration: 60,
                details: "Haircut, Trim, D-Tan",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 100, duration: 15 },
                    { name: "D-Tan", price: 249, duration: 15 }
                ]
            },
            {
                name: "Relaxation Package",
                price: 750,
                duration: 60,
                details: "Haircut, Trim, Head Massage",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 100, duration: 15 },
                    { name: "Head Massage", price: 400, duration: 15 }
                ]
            },
            {
                name: "Color Refresh Package",
                price: 750,
                duration: 90,
                details: "Haircut, Trim, Basic Hair Color",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 100, duration: 15 },
                    { name: "Basic Hair Color", price: 400, duration: 45 }
                ]
            },
            {
                name: "Classic Facial Package",
                price: 999,
                duration: 90,
                details: "Haircut, Trim, Basic Facial",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 100, duration: 15 },
                    { name: "Basic Facial", price: 649, duration: 45 }
                ]
            },
            {
                name: "Premium Wine Facial Package",
                price: 1499,
                duration: 120,
                details: "Haircut, Trim, D-Tan, Wine Facial",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 100, duration: 15 },
                    { name: "D-Tan", price: 300, duration: 30 },
                    { name: "Wine Facial", price: 849, duration: 45 }
                ]
            },
            {
                name: "Premium Fruit Facial Package",
                price: 1799,
                duration: 120,
                details: "Haircut, Trim, D-Tan, Fruit Facial",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 100, duration: 15 },
                    { name: "D-Tan", price: 300, duration: 30 },
                    { name: "Fruit Facial", price: 1149, duration: 45 }
                ]
            },
            {
                name: "Skin Brightening Package",
                price: 1999,
                duration: 120,
                details: "Haircut, Trim, D-Tan, Lightening Facial",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 100, duration: 15 },
                    { name: "D-Tan", price: 300, duration: 30 },
                    { name: "Lightening Facial", price: 1349, duration: 45 }
                ]
            },
            {
                name: "Groom Combo 1",
                price: 3000,
                duration: 150,
                details: "Haircut, Trim, Lightening Facial",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 150, duration: 30 },
                    { name: "Lightening Facial", price: 2600, duration: 90 }
                ]
            },
            {
                name: "Groom Combo 2",
                price: 4000,
                duration: 180,
                details: "Haircut, Trim, D-Tan, Vitamin-C Facial",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 150, duration: 30 },
                    { name: "D-Tan", price: 500, duration: 30 },
                    { name: "Vitamin-C Facial", price: 3100, duration: 90 }
                ]
            },
            {
                name: "Groom Combo 3",
                price: 6000,
                duration: 240,
                details: "Haircut, Trim, D-Tan, Glow On Facial",
                subServices: [
                    { name: "Haircut", price: 250, duration: 30 },
                    { name: "Trim", price: 150, duration: 30 },
                    { name: "D-Tan", price: 500, duration: 30 },
                    { name: "Glow On Facial", price: 5100, duration: 150 }
                ]
            }
        ]
    },
    Women: {
        "Haircuts": [
            { name: "Women's Haircut (Straight Cut)", price: 1000, duration: 45 },
            { name: "Women's Haircut (U & V Cut)", price: 1000, duration: 45 },
            { name: "Women's Haircut (Layers Cut)", price: 1500, duration: 60 }
        ],
        "Hair Color": [
            { name: "Root Touchup (Matrix)", price: 1750, duration: 60 },
            { name: "Root Touch Up (Advanced)", price: 2250, duration: 60 },
            { name: "Women's Color Full Head (Matrix)", price: 3000, duration: 120 },
            { name: "Women's Fashion Color", price: 5000, duration: 180 }
        ],
        "Hair Spa & Styling": [
            { name: "Deep Conditioning Spa", price: 1000, duration: 60 },
            { name: "Wash & Blowdry Setting", price: 700, duration: 45 },
            { name: "Wash & Blastdry", price: 500, duration: 30 }
        ],
        "Facial & Skin Care": [
            { name: "D-Tan", price: 500, duration: 30 },
            { name: "D-Tan (Advanced)", price: 1000, duration: 45 },
            { name: "Basic Cleanup", price: 800, duration: 45 },
            { name: "Basic Facial", price: 1000, duration: 60 },
            { name: "Fruit Facial", price: 1500, duration: 60 },
            { name: "Wine Facial", price: 1500, duration: 60 },
            { name: "Whitening Facial", price: 1500, duration: 60 },
            { name: "Skin Lightening Facial (Basic)", price: 1750, duration: 60 },
            { name: "Skin Lightening Facial", price: 2500, duration: 90 },
            { name: "Deep D-Tan Facial (Advanced)", price: 3000, duration: 90 },
            { name: "Brightening & Whitening Facial (Advanced)", price: 4000, duration: 90 },
            { name: "Bridal Glow Facial", price: 5000, duration: 120 },
            { name: "Glow On Facial (Advanced)", price: 6000, duration: 120 }
        ]
    },
    Kids: {
        "Haircuts": [
            { name: "Kids Cut (Below 10 Years)", price: 150, duration: 30 },
            { name: "Kids Cut (Advanced)", price: 500, duration: 45 }
        ]
    }
};

export const FLAT_SERVICES = Object.entries(HASHTAG_SERVICES).reduce((acc, [gender, categories]) => {
    Object.entries(categories).forEach(([category, services]) => {
        services.forEach(svc => {
            acc.push({
                ...svc,
                id: Math.random().toString(36).substring(7),
                category: category,
                gender: gender
            });
        });
    });
    return acc;
}, []);
