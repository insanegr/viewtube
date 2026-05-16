export type Language = 'en' | 'el';

export const translations = {
  en: {
    // Header
    search: 'Search',
    upload: 'Upload',
    myProfile: 'My Profile',
    myPlaylists: 'My Playlists',
    admin: 'Admin Panel',
    
    // Sidebar
    home: 'Home',
    explore: 'Explore',
    subscriptions: 'Subscriptions',
    library: 'Library',
    liked: 'Liked',
    playlists: 'Playlists',
    categories: 'Categories',
    filterCategories: 'Filter by Categories',
    clearFilters: 'Clear Filters',
    matchAll: 'Match ALL',
    matchAny: 'Match ANY',
    
    // Theme
    theme: 'Theme',
    lightMode: 'Light',
    darkMode: 'Dark',
    autoMode: 'Auto',
    
    // Home
    all: 'All',
    noVideosFound: 'No videos found',
    tryDifferentCategory: 'Try a different category or upload your own!',
    
    // Video
    views: 'views',
    subscribe: 'Subscribe',
    subscribed: 'Subscribed',
    share: 'Share',
    download: 'Download',
    save: 'Save',
    saveToPlaylist: 'Save to playlist',
    noPlaylistsYet: 'No playlists yet',
    added: 'Added',
    comments: 'Comments',
    addComment: 'Add a comment...',
    cancel: 'Cancel',
    comment: 'Comment',
    linkCopied: 'Link copied to clipboard!',
    videoNotFound: 'Video not found',
    sampleVideo: 'Sample video - no file available',
    relatedVideos: 'Related Videos',
    
    // Upload
    uploadVideo: 'Upload Video',
    uploadVideos: 'Upload Videos',
    dragAndDrop: 'Drag and drop video files',
    orClickToBrowse: 'or click to browse',
    supported: 'MP4, WebM, MOV supported',
    title: 'Title',
    enterVideoTitle: 'Enter video title',
    description: 'Description',
    enterVideoDescription: 'Enter video description',
    thumbnail: 'Thumbnail',
    uploadThumbnail: 'Upload thumbnail',
    category: 'Category',
    selectCategories: 'Select Categories',
    selectedCategories: 'selected',
    visibility: 'Visibility',
    public: 'Public',
    unlisted: 'Unlisted',
    private: 'Private',
    processingVideo: 'Processing video...',
    uploadNow: 'Upload Now',
    bulkUploadMode: 'Bulk Upload Mode',
    bulkUploadDesc: 'Upload multiple videos to the same categories',
    videosSelected: 'videos selected',
    
    // Profile
    subscribers: 'subscribers',
    videos: 'Videos',
    about: 'About',
    noVideosUploaded: 'No videos uploaded yet',
    uploadFirstVideo: 'Upload your first video',
    edit: 'Edit',
    delete: 'Delete',
    saveChanges: 'Save Changes',
    changeBanner: 'Change Banner',
    addBanner: 'Add Banner',
    
    // Playlists
    newPlaylist: 'New Playlist',
    createNewPlaylist: 'Create New Playlist',
    playlistName: 'Playlist name',
    descriptionOptional: 'Description (optional)',
    create: 'Create',
    noPlaylistsCreated: 'No playlists yet',
    createPlaylistDesc: 'Create a playlist to organize your favorite videos',
    playAll: 'Play All',
    dragToReorder: 'Drag to reorder',
    noVideosInPlaylist: 'No videos in this playlist',
    addVideosFromWatch: 'Add videos from the watch page',
    removeFromPlaylist: 'Remove from playlist',
    changeCover: 'Change cover',
    removeCover: 'Remove cover',
    playlistNotFound: 'Playlist not found',
    
    // Subscribers
    noSubscribersYet: 'No subscribers yet',
    shareContentToGrow: 'Share your content to grow your audience!',
    subscriber: 'Subscriber',
    
    // Search
    searchResultsFor: 'Search results for',
    resultsFound: 'results found',
    noResultsFound: 'No results found',
    tryDifferentKeywords: 'Try different keywords',
    
    // Explore
    trending: 'Trending',
    music: 'Music',
    gaming: 'Gaming',
    learning: 'Learning',
    noVideosInCategory: 'No videos in this category',
    
    // Subscriptions
    noSubscriptionsYet: 'No subscriptions yet',
    subscribeToChannels: 'Subscribe to channels to see their videos here',
    channelsToDiscover: 'Channels to discover',
    noVideosFromSubs: 'No videos from your subscriptions',
    
    // Library
    yourVideos: 'Your Videos',
    noUploadedVideos: 'No uploaded videos',
    yourPlaylists: 'Your Playlists',
    
    // Liked
    likedVideos: 'Liked Videos',
    noLikedVideos: 'No liked videos yet',
    likedVideosAppear: 'Videos you like will appear here',
    
    // Admin
    adminPanel: 'Admin Panel',
    categoryManagement: 'Category Management',
    addCategory: 'Add Category',
    categoryName: 'Category name',
    add: 'Add',
    editCategory: 'Edit Category',
    userManagement: 'User Management',
    grantVip: 'Grant VIP',
    revokeVip: 'Revoke VIP',
    makeAdmin: 'Make Admin',
    user: 'User',
    vip: 'VIP',
    role: 'Role',
    actions: 'Actions',
    confirmDeleteCategory: 'Delete this category? Videos in this category will be moved to "Entertainment".',
    noCategoriesYet: 'No categories yet',
    
    // Stats
    totalViews: 'Total Views',
    stats: 'Stats',

    // Settings
    settings: 'Settings',
    accountSettings: 'Account Settings',
    emailAddress: 'Email Address',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    changePassword: 'Change Password',
    profileSettings: 'Profile Settings',
    notifications: 'Notifications',
    enableNotifications: 'Enable email notifications',
    country: 'Country',
    passwordChanged: 'Password changed successfully',
    passwordMismatch: 'Passwords do not match',
    settingsSaved: 'Settings saved successfully',
    dangerZone: 'Danger Zone',
    deleteAccount: 'Delete Account',
    deleteAccountWarning: 'This action cannot be undone. All your videos, playlists, and data will be permanently deleted.',
    yourChannel: 'Your channel',
    you: 'You',
    signOut: 'Sign out',
    language: 'Language',
    addToQueue: 'Add to queue',
    removeFromQueue: 'Remove from queue',
    queue: 'Queue',
    upNext: 'Up next',
    clearQueue: 'Clear queue',

    // Auth
    signIn: 'Sign in',
    signInDesc: 'Welcome back to ViewTube',
    createAccount: 'Create account',
    createAccountDesc: 'Join ViewTube today',
    channelName: 'Channel name',
    password: 'Password',
    alreadyHaveAccount: 'Already have an account?',
    noAccount: "Don't have an account?",
    // Notifications
    notificationsTitle: 'Notifications',
    noNotifications: 'No notifications',
    markAllRead: 'Mark all as read',
    notifComment: 'commented on your video',
    notifReply: 'replied to your comment on',
    notifSubscribe: 'subscribed to your channel',
    notifLike: 'liked your video',

    // Watch History
    watchHistory: 'Watch history',
    clearHistory: 'Clear history',
    clearHistoryDesc: 'This will remove all videos from your watch history.',
    noHistory: 'No watch history',
    noHistoryDesc: 'Videos you watch will appear here',
    history: 'History',

    // Analytics
    analytics: 'Analytics',
    totalLikes: 'Total Likes',
    totalComments: 'Total Comments',
    topByViews: 'Top Videos by Views',
    topByLikes: 'Top Videos by Likes',
    mostCommented: 'Most Commented',

    // Upload progress
    uploading: 'Uploading...',
    uploadComplete: 'Upload complete!',
    uploadFailed: 'Upload failed',
  },
  el: {
    // Header
    search: 'Αναζήτηση',
    upload: 'Μεταφόρτωση',
    myProfile: 'Το Προφίλ μου',
    myPlaylists: 'Οι Λίστες μου',
    admin: 'Πίνακας Διαχείρισης',
    
    // Sidebar
    home: 'Αρχική',
    explore: 'Εξερεύνηση',
    subscriptions: 'Συνδρομές',
    library: 'Βιβλιοθήκη',
    liked: 'Μου αρέσει',
    playlists: 'Λίστες',
    categories: 'Κατηγορίες',
    filterCategories: 'Φιλτράρισμα ανά Κατηγορία',
    clearFilters: 'Καθαρισμός Φίλτρων',
    matchAll: 'ΟΛΕΣ οι κατηγορίες',
    matchAny: 'ΟΠΟΙΑΔΗΠΟΤΕ κατηγορία',
    
    // Theme
    theme: 'Θέμα',
    lightMode: 'Φωτεινό',
    darkMode: 'Σκοτεινό',
    autoMode: 'Αυτόματο',
    
    // Home
    all: 'Όλα',
    noVideosFound: 'Δεν βρέθηκαν βίντεο',
    tryDifferentCategory: 'Δοκιμάστε διαφορετική κατηγορία ή ανεβάστε το δικό σας!',
    
    // Video
    views: 'προβολές',
    subscribe: 'Εγγραφή',
    subscribed: 'Εγγεγραμμένος',
    share: 'Κοινοποίηση',
    download: 'Λήψη',
    save: 'Αποθήκευση',
    saveToPlaylist: 'Αποθήκευση σε λίστα',
    noPlaylistsYet: 'Δεν υπάρχουν λίστες',
    added: 'Προστέθηκε',
    comments: 'Σχόλια',
    addComment: 'Προσθέστε σχόλιο...',
    cancel: 'Ακύρωση',
    comment: 'Σχόλιο',
    linkCopied: 'Ο σύνδεσμος αντιγράφηκε!',
    videoNotFound: 'Το βίντεο δεν βρέθηκε',
    sampleVideo: 'Δείγμα βίντεο - δεν υπάρχει αρχείο',
    relatedVideos: 'Σχετικά Βίντεο',
    
    // Upload
    uploadVideo: 'Μεταφόρτωση Βίντεο',
    uploadVideos: 'Μεταφόρτωση Βίντεο',
    dragAndDrop: 'Σύρετε και αποθέστε αρχεία βίντεο',
    orClickToBrowse: 'ή κάντε κλικ για περιήγηση',
    supported: 'Υποστηρίζονται MP4, WebM, MOV',
    title: 'Τίτλος',
    enterVideoTitle: 'Εισάγετε τίτλο βίντεο',
    description: 'Περιγραφή',
    enterVideoDescription: 'Εισάγετε περιγραφή βίντεο',
    thumbnail: 'Μικρογραφία',
    uploadThumbnail: 'Ανέβασμα μικρογραφίας',
    category: 'Κατηγορία',
    selectCategories: 'Επιλογή Κατηγοριών',
    selectedCategories: 'επιλεγμένες',
    visibility: 'Ορατότητα',
    public: 'Δημόσιο',
    unlisted: 'Μη καταχωρημένο',
    private: 'Ιδιωτικό',
    processingVideo: 'Επεξεργασία βίντεο...',
    uploadNow: 'Μεταφόρτωση Τώρα',
    bulkUploadMode: 'Μαζική Μεταφόρτωση',
    bulkUploadDesc: 'Ανεβάστε πολλά βίντεο στις ίδιες κατηγορίες',
    videosSelected: 'βίντεο επιλέχθηκαν',
    
    // Profile
    subscribers: 'συνδρομητές',
    videos: 'Βίντεο',
    about: 'Σχετικά',
    noVideosUploaded: 'Δεν έχουν ανεβεί βίντεο ακόμα',
    uploadFirstVideo: 'Ανεβάστε το πρώτο σας βίντεο',
    edit: 'Επεξεργασία',
    delete: 'Διαγραφή',
    saveChanges: 'Αποθήκευση Αλλαγών',
    changeBanner: 'Αλλαγή Banner',
    addBanner: 'Προσθήκη Banner',
    
    // Playlists
    newPlaylist: 'Νέα Λίστα',
    createNewPlaylist: 'Δημιουργία Νέας Λίστας',
    playlistName: 'Όνομα λίστας',
    descriptionOptional: 'Περιγραφή (προαιρετικό)',
    create: 'Δημιουργία',
    noPlaylistsCreated: 'Δεν υπάρχουν λίστες ακόμα',
    createPlaylistDesc: 'Δημιουργήστε λίστα για να οργανώσετε τα αγαπημένα σας βίντεο',
    playAll: 'Αναπαραγωγή Όλων',
    dragToReorder: 'Σύρετε για αναδιάταξη',
    noVideosInPlaylist: 'Δεν υπάρχουν βίντεο σε αυτή τη λίστα',
    addVideosFromWatch: 'Προσθέστε βίντεο από τη σελίδα παρακολούθησης',
    removeFromPlaylist: 'Αφαίρεση από τη λίστα',
    changeCover: 'Αλλαγή εξωφύλλου',
    removeCover: 'Αφαίρεση εξωφύλλου',
    playlistNotFound: 'Η λίστα δεν βρέθηκε',
    
    // Subscribers
    noSubscribersYet: 'Δεν υπάρχουν συνδρομητές ακόμα',
    shareContentToGrow: 'Μοιραστείτε το περιεχόμενό σας για να αυξήσετε το κοινό σας!',
    subscriber: 'Συνδρομητής',
    
    // Search
    searchResultsFor: 'Αποτελέσματα αναζήτησης για',
    resultsFound: 'αποτελέσματα βρέθηκαν',
    noResultsFound: 'Δεν βρέθηκαν αποτελέσματα',
    tryDifferentKeywords: 'Δοκιμάστε διαφορετικές λέξεις-κλειδιά',
    
    // Explore
    trending: 'Τάσεις',
    music: 'Μουσική',
    gaming: 'Παιχνίδια',
    learning: 'Εκπαίδευση',
    noVideosInCategory: 'Δεν υπάρχουν βίντεο σε αυτή την κατηγορία',
    
    // Subscriptions
    noSubscriptionsYet: 'Δεν υπάρχουν συνδρομές ακόμα',
    subscribeToChannels: 'Εγγραφείτε σε κανάλια για να δείτε τα βίντεό τους εδώ',
    channelsToDiscover: 'Κανάλια για ανακάλυψη',
    noVideosFromSubs: 'Δεν υπάρχουν βίντεο από τις συνδρομές σας',
    
    // Library
    yourVideos: 'Τα Βίντεό σας',
    noUploadedVideos: 'Δεν υπάρχουν ανεβασμένα βίντεο',
    yourPlaylists: 'Οι Λίστες σας',
    
    // Liked
    likedVideos: 'Βίντεο που μου αρέσουν',
    noLikedVideos: 'Δεν υπάρχουν βίντεο που σας αρέσουν',
    likedVideosAppear: 'Τα βίντεο που σας αρέσουν θα εμφανίζονται εδώ',
    
    // Admin
    adminPanel: 'Πίνακας Διαχείρισης',
    categoryManagement: 'Διαχείριση Κατηγοριών',
    addCategory: 'Προσθήκη Κατηγορίας',
    categoryName: 'Όνομα κατηγορίας',
    add: 'Προσθήκη',
    editCategory: 'Επεξεργασία Κατηγορίας',
    userManagement: 'Διαχείριση Χρηστών',
    grantVip: 'Παροχή VIP',
    revokeVip: 'Ανάκληση VIP',
    makeAdmin: 'Ορισμός Διαχειριστή',
    user: 'Χρήστης',
    vip: 'VIP',
    role: 'Ρόλος',
    actions: 'Ενέργειες',
    confirmDeleteCategory: 'Διαγραφή αυτής της κατηγορίας; Τα βίντεο θα μετακινηθούν στην "Ψυχαγωγία".',
    noCategoriesYet: 'Δεν υπάρχουν κατηγορίες ακόμα',
    
    // Stats
    totalViews: 'Συνολικές Προβολές',
    stats: 'Στατιστικά',

    // Settings
    settings: 'Ρυθμίσεις',
    accountSettings: 'Ρυθμίσεις Λογαριασμού',
    emailAddress: 'Διεύθυνση Email',
    currentPassword: 'Τρέχων Κωδικός',
    newPassword: 'Νέος Κωδικός',
    confirmPassword: 'Επιβεβαίωση Κωδικού',
    changePassword: 'Αλλαγή Κωδικού',
    profileSettings: 'Ρυθμίσεις Προφίλ',
    notifications: 'Ειδοποιήσεις',
    enableNotifications: 'Ενεργοποίηση ειδοποιήσεων email',
    country: 'Χώρα',
    passwordChanged: 'Ο κωδικός άλλαξε επιτυχώς',
    passwordMismatch: 'Οι κωδικοί δεν ταιριάζουν',
    settingsSaved: 'Οι ρυθμίσεις αποθηκεύτηκαν',
    dangerZone: 'Ζώνη Κινδύνου',
    deleteAccount: 'Διαγραφή Λογαριασμού',
    deleteAccountWarning: 'Αυτή η ενέργεια δεν μπορεί να αναιρεθεί. Όλα τα βίντεο, οι λίστες και τα δεδομένα σας θα διαγραφούν μόνιμα.',
    yourChannel: 'Το κανάλι σας',
    you: 'Εσύ',
    signOut: 'Αποσύνδεση',
    language: 'Γλώσσα',
    addToQueue: 'Προσθήκη στην ουρά',
    removeFromQueue: 'Αφαίρεση από την ουρά',
    queue: 'Ουρά',
    upNext: 'Επόμενο',
    clearQueue: 'Καθαρισμός ουράς',

    // Auth
    signIn: 'Σύνδεση',
    signInDesc: 'Καλώς ήρθατε στο ViewTube',
    createAccount: 'Δημιουργία λογαριασμού',
    createAccountDesc: 'Γίνετε μέλος του ViewTube',
    channelName: 'Όνομα καναλιού',
    password: 'Κωδικός',
    alreadyHaveAccount: 'Έχετε ήδη λογαριασμό;',
    noAccount: 'Δεν έχετε λογαριασμό;',
    // Notifications
    notificationsTitle: 'Ειδοποιήσεις',
    noNotifications: 'Δεν υπάρχουν ειδοποιήσεις',
    markAllRead: 'Σήμανση όλων ως αναγνωσμένα',
    notifComment: 'σχολίασε το βίντεό σας',
    notifReply: 'απάντησε στο σχόλιό σας στο',
    notifSubscribe: 'εγγράφηκε στο κανάλι σας',
    notifLike: 'έκανε like στο βίντεό σας',

    // Watch History
    watchHistory: 'Ιστορικό παρακολούθησης',
    clearHistory: 'Εκκαθάριση ιστορικού',
    clearHistoryDesc: 'Θα αφαιρεθούν όλα τα βίντεο από το ιστορικό σας.',
    noHistory: 'Κανένα ιστορικό',
    noHistoryDesc: 'Τα βίντεο που παρακολουθείτε θα εμφανίζονται εδώ',
    history: 'Ιστορικό',

    // Analytics
    analytics: 'Αναλυτικά',
    totalLikes: 'Σύνολο Likes',
    totalComments: 'Σύνολο Σχολίων',
    topByViews: 'Κορυφαία βίντεο κατά Προβολές',
    topByLikes: 'Κορυφαία βίντεο κατά Likes',
    mostCommented: 'Περισσότερα Σχόλια',

    // Upload progress
    uploading: 'Μεταφόρτωση...',
    uploadComplete: 'Η μεταφόρτωση ολοκληρώθηκε!',
    uploadFailed: 'Η μεταφόρτωση απέτυχε',
  },
};

export type TranslationKey = keyof typeof translations.en;
