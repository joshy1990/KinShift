// Firestore Rules Test Suite
// This is a template for testing rules with Firebase Emulator

// Test utilities would be run with: firebase emulators:exec 'npm run test:firestore'
// Using: @firebase/rules-unit-testing

const firebase = require('@firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, query, where, getDocs } = require('@firebase/firestore');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'linkshift-test',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ========================================
// TEST SUITE 1: USER ACCESS
// ========================================

describe('User Access Tests', () => {
  test('User can read their own profile', async () => {
    const userId = 'user123';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', userId), {
        email: 'user@example.com',
        name: 'Test User',
      });
    });
    
    await assertSucceeds(getDoc(doc(db, 'users', userId)));
  });

  test('User cannot read another user profile', async () => {
    const userId1 = 'user123';
    const userId2 = 'user456';
    const db = testEnv.authenticatedContext(userId1).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', userId2), {
        email: 'other@example.com',
      });
    });
    
    await assertFails(getDoc(doc(db, 'users', userId2)));
  });

  test('User can update their own profile', async () => {
    const userId = 'user123';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', userId), {
        email: 'user@example.com',
      });
    });
    
    await assertSucceeds(setDoc(doc(db, 'users', userId), {
      email: 'newemail@example.com',
    }));
  });

  test('User cannot update another user profile', async () => {
    const userId1 = 'user123';
    const userId2 = 'user456';
    const db = testEnv.authenticatedContext(userId1).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', userId2), {
        email: 'other@example.com',
      });
    });
    
    await assertFails(setDoc(doc(db, 'users', userId2), {
      email: 'hacked@example.com',
    }));
  });
});

// ========================================
// TEST SUITE 2: HOUSEHOLD ACCESS
// ========================================

describe('Household Access Tests', () => {
  test('Admin can read and write household', async () => {
    const adminId = 'admin123';
    const householdId = 'household1';
    const db = testEnv.authenticatedContext(adminId).firestore();
    
    // Create household with admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [adminId],
        members: [adminId],
        name: 'Test Household',
        settings: { allowMemberEditOthers: false },
      });
    });
    
    // Admin should be able to read
    await assertSucceeds(getDoc(doc(db, 'households', householdId)));
    
    // Admin should be able to write
    await assertSucceeds(setDoc(doc(db, 'households', householdId), {
      name: 'Updated Household',
    }, { merge: true }));
  });

  test('Non-admin member cannot write household', async () => {
    const memberId = 'member123';
    const adminId = 'admin123';
    const householdId = 'household1';
    const db = testEnv.authenticatedContext(memberId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [adminId],
        members: [adminId, memberId],
        name: 'Test Household',
      });
    });
    
    // Member should be able to read
    await assertSucceeds(getDoc(doc(db, 'households', householdId)));
    
    // Member should NOT be able to write
    await assertFails(setDoc(doc(db, 'households', householdId), {
      name: 'Hacked',
    }, { merge: true }));
  });

  test('Member can read household settings', async () => {
    const memberId = 'member123';
    const householdId = 'household1';
    const db = testEnv.authenticatedContext(memberId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: ['admin123'],
        members: [memberId],
        settings: { allowMemberEditOthers: true },
      });
    });
    
    await assertSucceeds(getDoc(doc(db, 'households', householdId, 'settings', 'config')));
  });

  test('Non-admin cannot update household settings', async () => {
    const memberId = 'member123';
    const householdId = 'household1';
    const db = testEnv.authenticatedContext(memberId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId, 'settings', 'config'), {
        allowMemberEditOthers: false,
      });
    });
    
    await assertFails(setDoc(doc(db, 'households', householdId, 'settings', 'config'), {
      allowMemberEditOthers: true,
    }));
  });
});

// ========================================
// TEST SUITE 3: SHIFT ACCESS
// ========================================

describe('Shift Access Tests', () => {
  test('Shift owner can read own shift', async () => {
    const ownerId = 'owner123';
    const shiftId = 'shift1';
    const db = testEnv.authenticatedContext(ownerId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shifts', shiftId), {
        ownerId,
        title: 'My Shift',
        startTime: new Date(),
        endTime: new Date(),
        createdAt: new Date(),
      });
    });
    
    await assertSucceeds(getDoc(doc(db, 'shifts', shiftId)));
  });

  test('Non-owner cannot read personal shift', async () => {
    const ownerId = 'owner123';
    const userId = 'user456';
    const shiftId = 'shift1';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shifts', shiftId), {
        ownerId,
        title: 'My Shift',
        startTime: new Date(),
        endTime: new Date(),
        createdAt: new Date(),
      });
    });
    
    await assertFails(getDoc(doc(db, 'shifts', shiftId)));
  });

  test('Household member can read household shift', async () => {
    const ownerId = 'owner123';
    const memberId = 'member123';
    const householdId = 'household1';
    const shiftId = 'shift1';
    const db = testEnv.authenticatedContext(memberId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [ownerId],
        members: [ownerId, memberId],
      });
      
      await setDoc(doc(context.firestore(), 'shifts', shiftId), {
        householdId,
        ownerId,
        title: 'Household Shift',
        startTime: new Date(),
        endTime: new Date(),
        createdAt: new Date(),
      });
    });
    
    await assertSucceeds(getDoc(doc(db, 'shifts', shiftId)));
  });

  test('Non-member cannot read household shift', async () => {
    const ownerId = 'owner123';
    const userId = 'user456';
    const householdId = 'household1';
    const shiftId = 'shift1';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [ownerId],
        members: [ownerId],
      });
      
      await setDoc(doc(context.firestore(), 'shifts', shiftId), {
        householdId,
        ownerId,
        title: 'Household Shift',
      });
    });
    
    await assertFails(getDoc(doc(db, 'shifts', shiftId)));
  });

  test('Shift owner can delete their shift', async () => {
    const ownerId = 'owner123';
    const shiftId = 'shift1';
    const db = testEnv.authenticatedContext(ownerId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'shifts', shiftId), {
        ownerId,
        title: 'My Shift',
      });
    });
    
    await assertSucceeds(deleteDoc(doc(db, 'shifts', shiftId)));
  });

  test('Non-owner cannot delete shift', async () => {
    const ownerId = 'owner123';
    const userId = 'user456';
    const householdId = 'household1';
    const shiftId = 'shift1';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [ownerId],
        members: [ownerId, userId],
      });
      
      await setDoc(doc(context.firestore(), 'shifts', shiftId), {
        householdId,
        ownerId,
        title: 'Household Shift',
      });
    });
    
    await assertFails(deleteDoc(doc(db, 'shifts', shiftId)));
  });
});

// ========================================
// TEST SUITE 4: MESSAGE ACCESS
// ========================================

describe('Message Access Tests', () => {
  test('Household member can read shift messages', async () => {
    const memberId = 'member123';
    const householdId = 'household1';
    const shiftId = 'shift1';
    const messageId = 'msg1';
    const db = testEnv.authenticatedContext(memberId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        members: [memberId],
      });
      
      await setDoc(doc(context.firestore(), 'shifts', shiftId), {
        householdId,
        ownerId: memberId,
      });
      
      await setDoc(doc(context.firestore(), 'shiftMessages', messageId), {
        shiftId,
        authorId: 'other123',
        text: 'Test message',
        createdAt: new Date(),
      });
    });
    
    await assertSucceeds(getDoc(doc(db, 'shiftMessages', messageId)));
  });

  test('Non-member cannot read shift messages', async () => {
    const userId = 'user123';
    const householdId = 'household1';
    const shiftId = 'shift1';
    const messageId = 'msg1';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        members: ['other123'],
      });
      
      await setDoc(doc(context.firestore(), 'shifts', shiftId), {
        householdId,
        ownerId: 'other123',
      });
      
      await setDoc(doc(context.firestore(), 'shiftMessages', messageId), {
        shiftId,
        authorId: 'other123',
        text: 'Test message',
      });
    });
    
    await assertFails(getDoc(doc(db, 'shiftMessages', messageId)));
  });
});

// ========================================
// TEST SUITE 5: INVITATION ACCESS
// ========================================

describe('Invitation Access Tests', () => {
  test('Invited user can read invitation', async () => {
    const invitedUserId = 'invited123';
    const invitationId = 'invite1';
    const db = testEnv.authenticatedContext(invitedUserId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invitations', invitationId), {
        invitedUserId,
        householdId: 'household1',
        status: 'pending',
      });
    });
    
    await assertSucceeds(getDoc(doc(db, 'invitations', invitationId)));
  });

  test('Non-invited user cannot read invitation', async () => {
    const userId = 'user123';
    const invitationId = 'invite1';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invitations', invitationId), {
        invitedUserId: 'other123',
        householdId: 'household1',
        status: 'pending',
      });
    });
    
    await assertFails(getDoc(doc(db, 'invitations', invitationId)));
  });

  test('Household admin can create invitation', async () => {
    const adminId = 'admin123';
    const householdId = 'household1';
    const db = testEnv.authenticatedContext(adminId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [adminId],
        members: [adminId],
      });
    });
    
    await assertSucceeds(setDoc(doc(db, 'invitations', 'invite1'), {
      invitedUserId: 'newuser123',
      householdId,
      status: 'pending',
    }));
  });

  test('Non-admin cannot create invitation', async () => {
    const memberId = 'member123';
    const adminId = 'admin123';
    const householdId = 'household1';
    const db = testEnv.authenticatedContext(memberId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [adminId],
        members: [adminId, memberId],
      });
    });
    
    await assertFails(setDoc(doc(db, 'invitations', 'invite1'), {
      invitedUserId: 'newuser123',
      householdId,
      status: 'pending',
    }));
  });

  test('Invited user can update invitation status', async () => {
    const invitedUserId = 'invited123';
    const invitationId = 'invite1';
    const db = testEnv.authenticatedContext(invitedUserId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invitations', invitationId), {
        invitedUserId,
        householdId: 'household1',
        status: 'pending',
      });
    });
    
    await assertSucceeds(setDoc(doc(db, 'invitations', invitationId), {
      status: 'accepted',
    }, { merge: true }));
  });
});

// ========================================
// TEST SUITE 6: NOTIFICATION ACCESS
// ========================================

describe('Notification Access Tests', () => {
  test('User can read own notifications', async () => {
    const userId = 'user123';
    const notificationId = 'notif1';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notifications', notificationId), {
        userId,
        message: 'Test notification',
      });
    });
    
    await assertSucceeds(getDoc(doc(db, 'notifications', notificationId)));
  });

  test('User cannot read other user notifications', async () => {
    const userId = 'user123';
    const otherUserId = 'user456';
    const notificationId = 'notif1';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notifications', notificationId), {
        userId: otherUserId,
        message: 'Test notification',
      });
    });
    
    await assertFails(getDoc(doc(db, 'notifications', notificationId)));
  });

  test('Client cannot write notifications', async () => {
    const userId = 'user123';
    const db = testEnv.authenticatedContext(userId).firestore();
    
    await assertFails(setDoc(doc(db, 'notifications', 'notif1'), {
      userId,
      message: 'Fake notification',
    }));
  });
});

module.exports = {
  // Export for test running
};
