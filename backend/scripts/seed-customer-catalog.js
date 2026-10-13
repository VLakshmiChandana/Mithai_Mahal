/**
 * Idempotent, Non-Destructive Demo Catalogue Seeder (Phase 11)
 * 
 * Features:
 * - Seeds 4 clearly labeled fictional demo sweet shops.
 * - Seeds authentic categories and sweet products for each shop.
 * - Never drops or deletes existing real business records.
 * - Safe for repeated execution via ON DUPLICATE KEY UPDATE.
 */

const bcrypt = require('bcrypt');
const { pool } = require('../src/config/db');

const DEMO_SHOPS = [
  {
    id: '11111111-0000-0000-0000-000000000001',
    businessName: 'Anand Mithai Bhandar (Demo)',
    legalName: 'Anand Sweets Demo LLP',
    businessType: 'LLP',
    email: 'anand.demo@sweetshop.internal',
    phone: '+919811000001',
    gstin: '29ANAND1234D1Z1',
    logo: '/sweets/shop-storefront.svg',
    categories: [
      {
        id: '11111111-0000-0000-0001-000000000001',
        name: 'Laddus & Pedas',
        description: 'Traditional round sweet delicacies made with pure cow ghee and cardamom.',
        displayOrder: 1,
        products: [
          {
            id: '11111111-0000-0002-0001-000000000001',
            name: 'Pure Desi Ghee Motichoor Laddu (500g)',
            description: 'Melt-in-mouth golden pearls of gram flour sweetened with saffron-infused syrup.',
            price: 320.00,
            stockQuantity: 45,
            imageUrl: '/sweets/motichoor-laddu.svg'
          },
          {
            id: '11111111-0000-0002-0001-000000000002',
            name: 'Kesar Khoya Peda (400g)',
            description: 'Rich slow-cooked condensed milk fudge flavored with pure Kashmiri saffron.',
            price: 290.00,
            stockQuantity: 30,
            imageUrl: '/sweets/motichoor-laddu.svg'
          },
          {
            id: '11111111-0000-0002-0001-000000000003',
            name: 'Besan Laddu with Dry Fruits (500g)',
            description: 'Roasted gram flour spheres enriched with pure desi ghee, almonds, and cashews.',
            price: 340.00,
            stockQuantity: 40,
            imageUrl: '/sweets/motichoor-laddu.svg'
          }
        ]
      },
      {
        id: '11111111-0000-0000-0001-000000000002',
        name: 'Royal Katlis & Barfis',
        description: 'Exquisite diamond cuts made from premium cashews, pistachios, and silver vark.',
        displayOrder: 2,
        products: [
          {
            id: '11111111-0000-0002-0001-000000000004',
            name: 'Diamond Kaju Katli (500g)',
            description: 'Classic diamond-shaped cashew fudge with delicate edible silver foil.',
            price: 490.00,
            stockQuantity: 50,
            imageUrl: '/sweets/kaju-katli.svg'
          },
          {
            id: '11111111-0000-0002-0001-000000000005',
            name: 'Pista Katli Royal Box (400g)',
            description: 'Fragrant emerald pistachio fudge crafted with hand-selected Iranian pistachios.',
            price: 580.00,
            stockQuantity: 25,
            imageUrl: '/sweets/kaju-katli.svg'
          }
        ]
      }
    ]
  },
  {
    id: '22222222-0000-0000-0000-000000000002',
    businessName: 'Bansiwala Pure Ghee Sweets (Demo)',
    legalName: 'Bansiwala Sweets Demo Private Limited',
    businessType: 'PVT_LTD',
    email: 'bansiwala.demo@sweetshop.internal',
    phone: '+919822000002',
    gstin: '29BANSI1234E1Z2',
    logo: '/sweets/shop-storefront.svg',
    categories: [
      {
        id: '22222222-0000-0000-0001-000000000001',
        name: 'Syrupy Delicacies',
        description: 'Warm, syrupy fried dumplings soaked in aromatic rose and cardamom syrups.',
        displayOrder: 1,
        products: [
          {
            id: '22222222-0000-0002-0001-000000000001',
            name: 'Shahi Rose Gulab Jamun (500g)',
            description: 'Soft melt-in-mouth milk-solid dumplings soaked in rosewater and saffron sugar syrup.',
            price: 260.00,
            stockQuantity: 60,
            imageUrl: '/sweets/gulab-jamun.svg'
          },
          {
            id: '22222222-0000-0002-0001-000000000002',
            name: 'Crispy Saffron Jalebi (400g)',
            description: 'Spiral crunchy golden delights soaked in warm saffron syrup, fried in pure cow ghee.',
            price: 240.00,
            stockQuantity: 35,
            imageUrl: '/sweets/crispy-jalebi.svg'
          }
        ]
      },
      {
        id: '22222222-0000-0000-0001-000000000002',
        name: 'Dry Fruit Sweets',
        description: 'Sugar-free and natural sweetness packed with roasted nuts and figs.',
        displayOrder: 2,
        products: [
          {
            id: '22222222-0000-0002-0001-000000000003',
            name: 'Anjeer Dry Fruit Roll (400g)',
            description: 'No added sugar roll crafted from Turkish figs, crunchy cashews, and California almonds.',
            price: 540.00,
            stockQuantity: 20,
            imageUrl: '/sweets/kaju-katli.svg'
          }
        ]
      }
    ]
  },
  {
    id: '33333333-0000-0000-0000-000000000003',
    businessName: 'Gokul Bengali Mithai (Demo)',
    legalName: 'Gokul Sweets Demo LLP',
    businessType: 'LLP',
    email: 'gokul.demo@sweetshop.internal',
    phone: '+919833000003',
    gstin: '29GOKUL1234F1Z3',
    logo: '/sweets/shop-storefront.svg',
    categories: [
      {
        id: '33333333-0000-0000-0001-000000000001',
        name: 'Bengali Chhena Classics',
        description: 'Delicate fresh cottage cheese (chhena) confections from Bengal.',
        displayOrder: 1,
        products: [
          {
            id: '33333333-0000-0002-0001-000000000001',
            name: 'Classic Spongy Rasgulla (1kg Tin)',
            description: 'Light, airy fresh chhena spheres immersed in light cardamom syrup.',
            price: 250.00,
            stockQuantity: 50,
            imageUrl: '/sweets/bengali-rasgulla.svg'
          },
          {
            id: '33333333-0000-0002-0001-000000000002',
            name: 'Kesar Rasmalai Box of 6',
            description: 'Chhena patties steeped in chilled thickened saffron milk garnished with pistachios.',
            price: 320.00,
            stockQuantity: 25,
            imageUrl: '/sweets/bengali-rasgulla.svg'
          },
          {
            id: '33333333-0000-0002-0001-000000000003',
            name: 'Malai Cham Cham (500g)',
            description: 'Elongated chhena sweets coated in rich clotted cream and crushed dry fruits.',
            price: 360.00,
            stockQuantity: 30,
            imageUrl: '/sweets/bengali-rasgulla.svg'
          }
        ]
      }
    ]
  },
  {
    id: '44444444-0000-0000-0000-000000000004',
    businessName: 'Dakshin Sweet Delights (Demo)',
    legalName: 'Dakshin Sweets Demo Enterprise',
    businessType: 'PROPRIETORSHIP',
    email: 'dakshin.demo@sweetshop.internal',
    phone: '+919844000004',
    gstin: '29DAKSH1234G1Z4',
    logo: '/sweets/shop-storefront.svg',
    categories: [
      {
        id: '44444444-0000-0000-0001-000000000001',
        name: 'South Indian Specialties',
        description: 'Authentic royal ghee-laden specialties from the heart of South India.',
        displayOrder: 1,
        products: [
          {
            id: '44444444-0000-0002-0001-000000000001',
            name: 'Royal Ghee Mysore Pak (400g)',
            description: 'Porous, rich dessert made from generous amounts of pure cow ghee, sugar, and gram flour.',
            price: 380.00,
            stockQuantity: 40,
            imageUrl: '/sweets/mysore-pak.svg'
          },
          {
            id: '44444444-0000-0002-0001-000000000002',
            name: 'Tirupati Style Besan Ladoo (500g)',
            description: 'Traditional prasadam-style aromatic laddus made with rich ghee, cardamom, and sugar candy.',
            price: 310.00,
            stockQuantity: 30,
            imageUrl: '/sweets/motichoor-laddu.svg'
          }
        ]
      }
    ]
  }
];

async function seedCatalogue() {
  console.log('===============================================================');
  console.log('SEEDING PHASE 11 DEMO SWEET SHOPS AND CATALOGUE (IDEMPOTENT)');
  console.log('===============================================================');

  const connection = await pool.getConnection();
  try {
    const passwordHash = await bcrypt.hash('DemoShopPassword123!', 10);

    for (const shop of DEMO_SHOPS) {
      // 1. Insert or update demo seller
      await connection.query(`
        INSERT INTO sellers (
          id, business_name, legal_name, business_type, email, phone, gstin,
          logo, password_hash, account_status, verification_status, is_active
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'APPROVED', TRUE
        ) ON DUPLICATE KEY UPDATE
          business_name = VALUES(business_name),
          legal_name = VALUES(legal_name),
          logo = VALUES(logo),
          account_status = 'ACTIVE',
          verification_status = 'APPROVED',
          is_active = TRUE;
      `, [
        shop.id, shop.businessName, shop.legalName, shop.businessType,
        shop.email, shop.phone, shop.gstin, shop.logo, passwordHash
      ]);

      console.log(`[+] Seeded Sweet Shop: ${shop.businessName}`);

      // 2. Insert categories
      for (const cat of shop.categories) {
        await connection.query(`
          INSERT INTO product_categories (
            id, seller_id, name, description, display_order, is_active
          ) VALUES (
            ?, ?, ?, ?, ?, TRUE
          ) ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = VALUES(description),
            display_order = VALUES(display_order),
            is_active = TRUE;
        `, [cat.id, shop.id, cat.name, cat.description, cat.displayOrder]);

        console.log(`    ├── Category: ${cat.name}`);

        // 3. Insert products
        for (const prod of cat.products) {
          await connection.query(`
            INSERT INTO products (
              id, seller_id, category_id, name, description, price,
              stock_quantity, image_url, availability_status, is_active
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', TRUE
            ) ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              description = VALUES(description),
              price = VALUES(price),
              stock_quantity = VALUES(stock_quantity),
              image_url = VALUES(image_url),
              availability_status = 'AVAILABLE',
              is_active = TRUE;
          `, [
            prod.id, shop.id, cat.id, prod.name, prod.description,
            prod.price, prod.stockQuantity, prod.imageUrl
          ]);

          console.log(`    │   └── Product: ${prod.name} (₹${prod.price})`);
        }
      }
    }

    console.log('\n===============================================================');
    console.log('DEMO CATALOGUE SEEDED SUCCESSFULLY!');
    console.log('===============================================================');
  } catch (err) {
    console.error('[!] Error seeding demo catalogue:', err);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedCatalogue();
