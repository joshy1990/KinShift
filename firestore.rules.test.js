// Firestore Rules Test Suite
// This is a template for testing rules with Firebase Emulator

// Test utilities would be run with: firebase emulators:exec 'npm run test:firestore'
// Using: @firebase/rules-unit-testing

const fs = require('fs');
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

// ========================================
// TEST SUITE 7: HOUSEHOLD JOIN SECURITY
// Tests for the tightened household update rules
// Non-members can ONLY update members, memberJoinDates, updatedAt
// ========================================

describe('Household Join Security Tests', () => {
  test('Non-member can join by adding themselves to members + memberJoinDates + updatedAt only', async () => {
    const joiningUser = 'joiner123';
    const adminId = 'admin123';
    const householdId = 'householdJoin1';
    const db = testEnv.authenticatedContext(joiningUser).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [adminId],
        members: [adminId],
        name: 'Join Test Household',
        joinCode: 'ABC123',
        updatedAt: new Date(),
      });
    });

    // Allowed: only changing members, memberJoinDates, updatedAt
    await assertSucceeds(setDoc(doc(db, 'households', householdId), {
      admins: [adminId],
      members: [adminId, joiningUser],
      name: 'Join Test Household',
      joinCode: 'ABC123',
      memberJoinDates: { [joiningUser]: new Date() },
      updatedAt: new Date(),
    }));
  });

  test('Non-member CANNOT change household name when joining', async () => {
    const joiningUser = 'joiner456';
    const adminId = 'admin123';
    const householdId = 'householdJoin2';
    const db = testEnv.authenticatedContext(joiningUser).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [adminId],
        members: [adminId],
        name: 'Original Name',
        joinCode: 'DEF456',
        updatedAt: new Date(),
      });
    });

    // Blocked: trying to change name while joining
    await assertFails(setDoc(doc(db, 'households', householdId), {
      admins: [adminId],
      members: [adminId, joiningUser],
      name: 'Hacked Name',
      joinCode: 'DEF456',
      memberJoinDates: { [joiningUser]: new Date() },
      updatedAt: new Date(),
    }));
  });

  test('Non-member CANNOT change admins when joining', async () => {
    const joiningUser = 'joiner789';
    const adminId = 'admin123';
    const householdId = 'householdJoin3';
    const db = testEnv.authenticatedContext(joiningUser).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [adminId],
        members: [adminId],
        name: 'Family',
        joinCode: 'GHI789',
        updatedAt: new Date(),
      });
    });

    // Blocked: trying to promote self to admin while joining
    await assertFails(setDoc(doc(db, 'households', householdId), {
      admins: [adminId, joiningUser],
      members: [adminId, joiningUser],
      name: 'Family',
      joinCode: 'GHI789',
      memberJoinDates: { [joiningUser]: new Date() },
      updatedAt: new Date(),
    }));
  });

  test('Non-member CANNOT change joinCode when joining', async () => {
    const joiningUser = 'joiner000';
    const adminId = 'admin123';
    const householdId = 'householdJoin4';
    const db = testEnv.authenticatedContext(joiningUser).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [adminId],
        members: [adminId],
        name: 'Family',
        joinCode: 'JKL000',
        updatedAt: new Date(),
      });
    });

    // Blocked: trying to change join code while joining
    await assertFails(setDoc(doc(db, 'households', householdId), {
      admins: [adminId],
      members: [adminId, joiningUser],
      name: 'Family',
      joinCode: 'HACKED',
      memberJoinDates: { [joiningUser]: new Date() },
      updatedAt: new Date(),
    }));
  });

  test('Existing member CAN update household freely', async () => {
    const memberId = 'admin123';
    const householdId = 'householdJoin5';
    const db = testEnv.authenticatedContext(memberId).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [memberId],
        members: [memberId],
        name: 'Family',
        joinCode: 'MNO012',
        updatedAt: new Date(),
      });
    });

    // Allowed: member can change any field
    await assertSucceeds(setDoc(doc(db, 'households', householdId), {
      admins: [memberId],
      members: [memberId],
      name: 'Updated Family',
      joinCode: 'NEWCODE',
      updatedAt: new Date(),
    }));
  });
});

// ========================================
// TEST SUITE 8: INVITATION TIGHTENED RULES
// Tests for tightened invitation create/update/delete
// ========================================

describe('Invitation Tightened Rules', () => {
  test('Household member can create invitation', async () => {
    const memberId = 'member123';
    const householdId = 'householdInv1';
    const db = testEnv.authenticatedContext(memberId).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [memberId],
        members: [memberId],
      });
    });

    await assertSucceeds(setDoc(doc(db, 'invitations', 'inv-1'), {
      householdId,
      invitedBy: memberId,
      emailOrPhone: 'test@example.com',
      status: 'pending',
    }));
  });

  test('Non-member CANNOT create invitation for a household', async () => {
    const outsider = 'outsider123';
    const adminId = 'admin123';
    const householdId = 'householdInv2';
    const db = testEnv.authenticatedContext(outsider).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', householdId), {
        admins: [adminId],
        members: [adminId],
      });
    });

    await assertFails(setDoc(doc(db, 'invitations', 'inv-2'), {
      householdId,
      invitedBy: outsider,
      emailOrPhone: 'hack@example.com',
      status: 'pending',
    }));
  });

  test('Invitation creator can update (cancel) their own invitation', async () => {
    const creator = 'creator123';
    const invId = 'inv-3';
    const db = testEnv.authenticatedContext(creator).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invitations', invId), {
        householdId: 'hh-1',
        invitedBy: creator,
        emailOrPhone: 'test@test.com',
        status: 'pending',
      });
    });

    await assertSucceeds(setDoc(doc(db, 'invitations', invId), {
      householdId: 'hh-1',
      invitedBy: creator,
      emailOrPhone: 'test@test.com',
      status: 'cancelled',
    }));
  });

  test('Accepting user can update invitation with their own acceptedBy', async () => {
    const acceptor = 'acceptor123';
    const invId = 'inv-4';
    const db = testEnv.authenticatedContext(acceptor).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invitations', invId), {
        householdId: 'hh-1',
        invitedBy: 'someone',
        emailOrPhone: 'acceptor@test.com',
        status: 'pending',
      });
    });

    await assertSucceeds(setDoc(doc(db, 'invitations', invId), {
      householdId: 'hh-1',
      invitedBy: 'someone',
      emailOrPhone: 'acceptor@test.com',
      status: 'accepted',
      acceptedBy: acceptor,
    }));
  });

  test('Random user CANNOT update invitation setting someone else as acceptedBy', async () => {
    const attacker = 'attacker123';
    const invId = 'inv-5';
    const db = testEnv.authenticatedContext(attacker).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invitations', invId), {
        householdId: 'hh-1',
        invitedBy: 'someone',
        emailOrPhone: 'victim@test.com',
        status: 'pending',
      });
    });

    // Attacker tries to accept on behalf of victim
    await assertFails(setDoc(doc(db, 'invitations', invId), {
      householdId: 'hh-1',
      invitedBy: 'someone',
      emailOrPhone: 'victim@test.com',
      status: 'accepted',
      acceptedBy: 'victim123',
    }));
  });

  test('Only invitation creator can delete an invitation', async () => {
    const creator = 'creator123';
    const other = 'other123';
    const invId = 'inv-6';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invitations', invId), {
        householdId: 'hh-1',
        invitedBy: creator,
        emailOrPhone: 'test@test.com',
        status: 'pending',
      });
    });

    // Other user cannot delete
    const dbOther = testEnv.authenticatedContext(other).firestore();
    await assertFails(deleteDoc(doc(dbOther, 'invitations', invId)));

    // Creator can delete
    const dbCreator = testEnv.authenticatedContext(creator).firestore();
    await assertSucceeds(deleteDoc(doc(dbCreator, 'invitations', invId)));
  });
});

module.exports = {
  // Export for test running
};
