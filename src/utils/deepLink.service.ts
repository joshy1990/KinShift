import {Linking} from 'react-native';
import {NavigationContainerRef} from '@react-navigation/native';
import {RootStackParamList} from '@/types';

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
  private handleDeepLink(url: string) {
    if (!this.navigationRef?.isReady()) {
      // Wait for navigation to be ready
      setTimeout(() => this.handleDeepLink(url), 100);
      return;
    }

    try {
      const parsedUrl = new URL(url);
      
      if (parsedUrl.protocol === 'linkshift:') {
        this.handleLinkShiftURL(parsedUrl);
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  }

  /**
   * Handle LinkShift specific URLs
   */
  private handleLinkShiftURL(url: URL) {
    const pathname = url.pathname;
    
    if (pathname.startsWith('/invite/')) {
      this.handleInvitationLink(pathname);
    }
  }

  /**
   * Handle invitation links: linkshift://invite/[inviteCode]
   */
  private handleInvitationLink(pathname: string) {
    const inviteCode = pathname.replace('/invite/', '');
    
    if (!inviteCode || inviteCode.length !== 8) {
      console.error('Invalid invitation code:', inviteCode);
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
    return `linkshift://invite/${inviteCode}`;
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