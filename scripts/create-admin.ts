#!/usr/bin/env ts-node

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🔧 Creating new admin user...');

    const email = '';
    const password = '-';
    const name = '-';

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(
        '⚠️ User with this email already exists:',
        existingUser.email,
      );
      console.log('   Role:', existingUser.role);
      console.log('   Status:', existingUser.status);
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the admin user
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: UserRole.admin,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('📋 User details:');
    console.log('   ID:', admin.id);
    console.log('   Email:', admin.email);
    console.log('   Name:', admin.name);
    console.log('   Role:', admin.role);
    console.log('   Status:', admin.status);
    console.log('   Created:', admin.createdAt);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createAdmin();
