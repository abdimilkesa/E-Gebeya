/**
 * Demo data for local development and the hackathon demo. Never runs in production.
 * Shops use fixed, hand-picked coordinates in central Jimma (approximate street
 * locations, not random numbers). Run `npm run db:seed` first.
 */
import { passwordSchema } from '@marketplace/contracts';
import { Prisma } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/lib/passwords.js';
import { prisma } from '../src/lib/prisma.js';
import { slugify } from '../src/lib/slug.js';

interface DemoProduct {
  name: string;
  description: string;
  price: string;
  stock: number;
  category: string;
  isAvailable?: boolean;
}

interface DemoShop {
  merchant: { username: string; fullName: string; businessName: string; phone: string };
  shop: {
    name: string;
    description: string;
    phone: string;
    addressText: string;
    latitude: string;
    longitude: string;
    deliveryFeeEtb: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
  };
  products: DemoProduct[];
}

const DEMO_SHOPS: DemoShop[] = [
  {
    merchant: {
      username: 'abebe_coffee',
      fullName: 'Abebe Kebede',
      businessName: 'Abebe Coffee House',
      phone: '0911223344',
    },
    shop: {
      name: 'Abebe Coffee House',
      description: 'Freshly roasted Jimma coffee, sold by the kilo and brewed to order.',
      phone: '0471112233',
      addressText: 'Near Abba Jifar Square, Jimma',
      latitude: '7.674200',
      longitude: '36.834600',
      deliveryFeeEtb: '50.00',
      bankName: 'Commercial Bank of Ethiopia',
      bankAccountName: 'Abebe Kebede',
      bankAccountNumber: '1000123456789',
    },
    products: [
      { name: 'Jimma Green Coffee Beans (1 kg)', description: 'Unroasted Grade 2 beans from local farms.', price: '650.00', stock: 40, category: 'Coffee & Tea' },
      { name: 'Medium Roast Coffee (500 g)', description: 'Roasted this week, whole beans.', price: '480.00', stock: 25, category: 'Coffee & Tea' },
      { name: 'Jebena Clay Coffee Pot', description: 'Hand-made traditional jebena, medium size.', price: '350.00', stock: 8, category: 'Handicrafts' },
      { name: 'Ethiopian Spiced Tea (250 g)', description: 'Black tea with cardamom and cinnamon.', price: '180.00', stock: 3, category: 'Coffee & Tea' },
    ],
  },
  {
    merchant: {
      username: 'selam_electronics',
      fullName: 'Selam Tesfaye',
      businessName: 'Selam Electronics',
      phone: '0722334455',
    },
    shop: {
      name: 'Selam Electronics',
      description: 'Phones, chargers and repairs with a 3-month warranty.',
      phone: '0722334455',
      addressText: 'Merkato Road, Jimma',
      latitude: '7.678900',
      longitude: '36.829800',
      deliveryFeeEtb: '80.00',
      bankName: 'Awash Bank',
      bankAccountName: 'Selam Tesfaye',
      bankAccountNumber: '0132456789012',
    },
    products: [
      { name: 'Android Smartphone 128 GB', description: '6.5 inch display, dual SIM, 5000 mAh battery.', price: '14500.00', stock: 6, category: 'Electronics' },
      { name: 'Fast Charger 25 W', description: 'USB-C charger with cable.', price: '650.00', stock: 30, category: 'Electronics' },
      { name: 'Bluetooth Earbuds', description: 'Up to 20 hours with the charging case.', price: '1800.00', stock: 0, category: 'Electronics' },
      { name: 'Solar Power Bank 20000 mAh', description: 'Charges two phones at once; solar panel for outages.', price: '2400.00', stock: 12, category: 'Electronics' },
    ],
  },
  {
    merchant: {
      username: 'tigist_fashion',
      fullName: 'Tigist Alemu',
      businessName: 'Tigist Fashion',
      phone: '0933445566',
    },
    shop: {
      name: 'Tigist Fashion',
      description: 'Habesha dresses, scarves and everyday wear.',
      phone: '0933445566',
      addressText: 'Hermata, Jimma',
      latitude: '7.669500',
      longitude: '36.838900',
      deliveryFeeEtb: '60.00',
      bankName: 'Bank of Abyssinia',
      bankAccountName: 'Tigist Alemu',
      bankAccountNumber: '45678901',
    },
    products: [
      { name: 'Habesha Kemis Dress', description: 'Hand-woven cotton with tibeb border.', price: '5200.00', stock: 4, category: 'Fashion' },
      { name: 'Netela Cotton Scarf', description: 'Light hand-woven shawl.', price: '900.00', stock: 15, category: 'Fashion' },
      { name: 'Leather Sandals', description: 'Locally made, sizes 37-44.', price: '1300.00', stock: 10, category: 'Fashion', isAvailable: false },
    ],
  },
  {
    merchant: {
      username: 'jimma_grocers',
      fullName: 'Kedir Abdella',
      businessName: 'Jimma Fresh Grocers',
      phone: '0944556677',
    },
    shop: {
      name: 'Jimma Fresh Grocers',
      description: 'Teff, spices, honey and fresh produce from nearby farms.',
      phone: '0944556677',
      addressText: 'Bosa Kito, Jimma',
      latitude: '7.665800',
      longitude: '36.831200',
      deliveryFeeEtb: '40.00',
      bankName: 'Commercial Bank of Ethiopia',
      bankAccountName: 'Kedir Abdella',
      bankAccountNumber: '1000987654321',
    },
    products: [
      { name: 'White Teff (5 kg)', description: 'Magna teff, cleaned and ready to mill.', price: '950.00', stock: 50, category: 'Groceries' },
      { name: 'Berbere Spice Mix (500 g)', description: 'House blend, medium heat.', price: '320.00', stock: 35, category: 'Groceries' },
      { name: 'Forest Honey (1 kg)', description: 'Raw honey from Jimma zone forests.', price: '700.00', stock: 2, category: 'Groceries' },
      { name: 'Niter Kibbeh (500 g)', description: 'Spiced clarified butter.', price: '560.00', stock: 9, category: 'Groceries' },
    ],
  },
];

const DEMO_CUSTOMER = { username: 'demo_customer', fullName: 'Hana Girma' };

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to load demo data in production.');
  }
  const password = passwordSchema.safeParse(process.env.DEMO_ACCOUNT_PASSWORD ?? '');
  if (!password.success) throw new Error('Set DEMO_ACCOUNT_PASSWORD (8-128 characters) in .env');
  const passwordHash = await hashPassword(password.data);

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const categoryId = new Map(categories.map((category) => [category.name, category.id]));
  if (categoryId.size === 0) throw new Error('No categories found. Run `npm run db:seed` first.');

  for (const demo of DEMO_SHOPS) {
    const exists = await prisma.user.findUnique({ where: { username: demo.merchant.username } });
    if (exists) {
      console.log(`Skipping ${demo.merchant.username}: already exists.`);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const merchant = await tx.user.create({
        data: {
          role: 'MERCHANT',
          username: demo.merchant.username,
          fullName: demo.merchant.fullName,
          passwordHash,
          merchantProfile: {
            create: { businessName: demo.merchant.businessName, contactPhone: demo.merchant.phone },
          },
        },
      });
      await tx.shop.create({
        data: {
          ...demo.shop,
          slug: slugify(demo.shop.name),
          latitude: new Prisma.Decimal(demo.shop.latitude),
          longitude: new Prisma.Decimal(demo.shop.longitude),
          deliveryFeeEtb: new Prisma.Decimal(demo.shop.deliveryFeeEtb),
          merchantId: merchant.id,
          products: {
            create: demo.products.map((product) => {
              const category = categoryId.get(product.category);
              if (!category) throw new Error(`Missing category "${product.category}"`);
              return {
                categoryId: category,
                name: product.name,
                description: product.description,
                price: new Prisma.Decimal(product.price),
                stockQuantity: product.stock,
                isAvailable: product.isAvailable ?? true,
              };
            }),
          },
        },
      });
    });
    console.log(`Created ${demo.merchant.username} with "${demo.shop.name}".`);
  }

  const customer = await prisma.user.findUnique({ where: { username: DEMO_CUSTOMER.username } });
  if (!customer) {
    await prisma.user.create({ data: { role: 'CUSTOMER', ...DEMO_CUSTOMER, passwordHash } });
    console.log(`Created customer ${DEMO_CUSTOMER.username}.`);
  }
  console.log('Demo accounts use the password in DEMO_ACCOUNT_PASSWORD.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
