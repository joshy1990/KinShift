import {Linking} from 'react-native';
import {NavigationContainerRef} from '@react-navigation/native';
import {RootStackParamList} from '@/types';
import auth from '@react-native-firebase/auth';

class DeepLinkService {
  private navigationRef: NavigationContainerRef<RootStackParamList> | null = null;

  /**
   * Set the navigation reference
   */
  setNavigationRef(ref: NavigationContainerRef<RootStackParamList>) {
    this.navigationRef = ref;
  }

  /**
   * Initialize deep link handling
   */
  initialize() {
    // Handle app launch from deep link
    Linking.getInitialURL().then(url => {
      if (url) {
        this.handleDeepLink(url);
      }
    });

    // Handle deep links when app is already running
    const subscription = Linking.addEventListener('url', ({url}) => {
      this.handleDeepLink(url);
    });

    return () => subscription?.remove();
  }

  /**
   * Handle deep link URLs
   */
  private deepLinkRetryCount = 0;
  private static MAX_DEEP_LINK_RETRIES = 50; // 5 seconds max

  private handleDeepLink(url: string) {
    if (!this.navigationRef?.isReady()) {
      if (this.deepLinkRetryCount >= DeepLinkService.MAX_DEEP_LINK_RETRIES) {
        console.error('Deep link handling aborted: navigation never became ready');
        this.deepLinkRetryCount = 0;
        return;
      }
      this.deepLinkRetryCount++;
      setTimeout(() => this.handleDeepLink(url), 100);
      return;
    }
    this.deepLinkRetryCount = 0;

    try {
      const parsedUrl = new URL(url);
      
      if (parsedUrl.protocol === 'kinshift:') {
        this.handleKinShiftURL(parsedUrl);
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  }

  /**
   * Handle KinShift specific URLs
   */
  private handleKinShiftURL(url: URL) {
    const pathname = url.pathname;
    
    if (pathname.startsWith('/invite/')) {
      this.handleInvitationLink(pathname);
    }
  }

  /**
   * Handle invitation links: kinshift://invite/[inviteCode]
   *
   * SECURITY: Verifies the user is authenticated before navigating.
   * Unauthenticated users are redirected to the login screen.
   */
  private handleInvitationLink(pathname: string) {
    const inviteCode = pathname.replace('/invite/', '');
    
    if (!inviteCode || !/^[A-Za-z0-9]{6,8}$/.test(inviteCode)) {
      console.error('Invalid invitation code format:', inviteCode);
      return;
    }

    // SECURITY: Require authentication before navigating to invitation acceptance
    const currentUser = auth().currentUser;
    if (!currentUser) {
      console.warn('Deep link blocked: user not authenticated');
      // Navigate to login screen instead — the deep link will be lost,
      // but the user can enter the code manually after signing in.
      if (this.navigationRef) {
        // @ts-ignore - Complex nested navigation typing
        this.navigationRef.navigate('Auth', { screen: 'Login' });
      }
      return;
    }

    // Navigate to invitation acceptance screen
    if (this.navigationRef) {
      // @ts-ignore - Complex nested navigation typing
      this.navigationRef.navigate('MainTabs', {
        screen: 'Household',
        params: {
          screen: 'InvitationAccept',
          params: {inviteCode}
        }
      });
    }
  }

  /**
   * Generate invitation deep link
   */
  generateInvitationLink(inviteCode: string): string {
  return `kinshift://invite/${inviteCode}`;
  }

  /**
   * Open invitation link externally (for testing)
   */
  async openInvitationLink(inviteCode: string) {
    const url = this.generateInvitationLink(inviteCode);
    try {
        const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open deep link:', url);
      }
    } catch (error) {
      console.error('Error opening deep link:', error);
    }
  }
}

export const deepLinkService = new DeepLinkService();