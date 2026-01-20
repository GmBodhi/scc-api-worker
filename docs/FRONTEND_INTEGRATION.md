# Frontend Integration Guide

## Quick Start

The v3 API provides a complete authentication system with:

- Traditional email/password authentication
- WebAuthn passkey support (passwordless)
- JWT token authentication (stateless, fast)
- Profile photo management with R2 storage

Base URL: `https://api.sctcoding.club`

## API Endpoints Quick Reference

### Authentication

- `POST /api/v3/auth/etlab/verify` - Verify EtLab credentials, initiate signup
- `POST /api/v3/auth/signup/complete` - Complete signup with password
- `POST /api/v3/auth/login` - Login with email/password
- `POST /api/v3/auth/refresh` - Refresh access token
- `POST /api/v3/auth/logout` - Logout and invalidate token

### Profile Management 🆕

- `GET /api/v3/auth/me` - Get current user details
- `PUT /api/v3/auth/profile` - Update profile (name, photo)

### Passkey Authentication (WebAuthn)

- `POST /api/v3/auth/passkey/register/start` - Start passkey registration
- `POST /api/v3/auth/passkey/register/verify` - Complete passkey registration
- `POST /api/v3/auth/passkey/login/start` - Start passkey login
- `POST /api/v3/auth/passkey/login/verify` - Complete passkey login

### Passkey Management 🆕

- `GET /api/v3/auth/passkeys` - List user's registered passkeys
- `DELETE /api/v3/auth/passkeys/:credential_id` - Delete a passkey

**Legend:** 🆕 = New endpoint | 🔒 = Requires authentication

## Authentication Methods

### 1. JWT Token Authentication (Recommended) ⚡

**Why JWT?**

- ✅ Stateless - no database lookups
- ✅ Fast - 10x faster than session-based auth
- ✅ Scalable - works across multiple servers
- ✅ Standard - RFC 7519 compliant

All login endpoints automatically return JWT tokens. Use them in the `Authorization` header:

```typescript
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

📖 **See:** [JWT Authentication Guide](./JWT_AUTHENTICATION.md) for detailed JWT documentation

### 2. Session Token Authentication (Legacy)

UUID-based session tokens stored in database. Works the same way from client perspective.

📖 **See:** [Session Management](./SESSION_MANAGEMENT.md) for comparison

## Common Workflows

### User Profile Update Flow

1. **User navigates to profile edit page**
2. **Load current user data**: `GET /api/v3/auth/me`
3. **User modifies name or uploads new photo**
4. **Submit changes**: `PUT /api/v3/auth/profile`
5. **Display success message and updated profile**

```typescript
// Example: Update just the name
await authAPI.updateProfile({ name: "New Name" });

// Example: Upload new photo
const base64Photo = await convertFileToBase64(photoFile);
await authAPI.updateProfile({
  profile_photo: base64Photo,
  profile_photo_filename: photoFile.name,
});

// Example: Remove photo
await authAPI.updateProfile({ profile_photo: null });

// Example: Update name and photo together
await authAPI.updateProfile({
  name: "New Name",
  profile_photo: base64Photo,
  profile_photo_filename: photoFile.name,
});
```

### Passkey Management Flow

1. **User navigates to security settings**
2. **List all passkeys**: `GET /api/v3/auth/passkeys`
3. **Display devices with creation and last used dates**
4. **User can delete unused/old passkeys**: `DELETE /api/v3/auth/passkeys/:id`
5. **Refresh list after deletion**

```typescript
// Load passkeys
const passkeys = await authAPI.listPasskeys();

// Delete a specific passkey
await authAPI.deletePasskey(passkey.credential_id);

// Reload list
const updatedPasskeys = await authAPI.listPasskeys();
```

### Complete Authentication + Profile Flow

1. **Signup**: EtLab verify → Complete signup
2. **Auto-login**: Receive JWT token + user data
3. **View profile**: Show user info with photo
4. **Edit profile**: Update name/photo as needed
5. **Add passkey**: Register for passwordless login
6. **Manage security**: View/delete passkeys

## API Endpoints

### Authentication Flow

#### Traditional Two-Step Signup

**Step 1: Verify with EtLab**

```http
POST /api/v3/auth/etlab/verify
Content-Type: application/json

{
  "username": "etlab_username"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "verification_token": "temp-token-123",
    "user": {
      "etlab_username": "johndoe",
      "name": "John Doe",
      "profile_photo_url": "https://etlab.sctcoding.club/..."
    }
  }
}
```

**Step 2: Complete Signup**

```http
POST /api/v3/auth/signup
Content-Type: application/json

{
  "verification_token": "temp-token-123",
  "email": "john@example.com",
  "password": "secure-password",
  "profile_photo": "<base64-encoded-image>" // optional, for custom photo
}
```

Response:

```json
{
  "success": true,
  "data": {
    "session_id": "jwt-token-here",
    "user": {
      "id": "user-id",
      "email": "john@example.com",
      "name": "John Doe",
      "etlab_username": "johndoe",
      "profile_photo_url": "https://..."
    }
  }
}
```

#### Traditional Login

```http
POST /api/v3/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "secure-password"
}
```

Response: Same as signup

#### Passkey Authentication (Passwordless)

📖 **See:** [Passkey Implementation Guide](./PASSKEY_IMPLEMENTATION.md) for complete WebAuthn integration

**Quick summary:**

1. Register passkey: `POST /api/v3/auth/passkey/register/start` → `POST /api/v3/auth/passkey/register/verify`
2. Login with passkey: `POST /api/v3/auth/passkey/login/start` → `POST /api/v3/auth/passkey/login/verify`

### Protected Endpoints

All protected endpoints require `Authorization: Bearer <token>` header.

#### Get Current User

```http
GET /api/v3/auth/me
Authorization: Bearer <your-token>
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "john@example.com",
    "name": "John Doe",
    "etlab_username": "johndoe",
    "profile_photo_url": "https://...",
    "created_at": 1703001600
  }
}
```

#### Logout

```http
POST /api/v3/auth/logout
Authorization: Bearer <your-token>
```

Response:

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Profile Management

#### Update Profile

```http
PUT /api/v3/auth/profile
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Updated Name",  // optional
  "profile_photo": "<base64-image-or-url>",  // optional
  "profile_photo_filename": "avatar.jpg"  // optional
}
```

**Profile Photo Options:**

- **Base64 encoded image**: `"data:image/jpeg;base64,/9j/4AAQSkZJRg..."` - Automatically uploaded to R2 storage
- **External URL**: `"https://example.com/photo.jpg"` - Stored as-is
- **Remove photo**: `null` - Removes current profile photo
- **Omit field**: Don't include `profile_photo` to keep current photo

Response:

```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "john@example.com",
    "name": "Updated Name",
    "etlab_username": "johndoe",
    "profile_photo_url": "https://profile-photos.sctcoding.club/profiles/...",
    "created_at": 1703001600
  },
  "message": "Profile updated successfully"
}
```

**Notes:**

- All fields are optional - only include what you want to update
- Name must not be empty if provided
- Profile photos are automatically optimized and stored in R2
- Returns 400 if no valid fields to update
- Returns 401 if not authenticated

### Passkey Management

#### List User's Passkeys

```http
GET /api/v3/auth/passkeys
Authorization: Bearer <your-token>
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "passkey-record-id",
      "credential_id": "credential-base64-id",
      "device_name": "Chrome on MacBook Pro",
      "created_at": 1703001600,
      "last_used_at": 1703088000
    },
    {
      "id": "passkey-record-id-2",
      "credential_id": "credential-base64-id-2",
      "device_name": "Safari on iPhone",
      "created_at": 1702915200,
      "last_used_at": null
    }
  ]
}
```

#### Delete Passkey

```http
DELETE /api/v3/auth/passkeys/:credential_id
Authorization: Bearer <your-token>
```

Response:

```json
{
  "success": true,
  "message": "Passkey deleted successfully"
}
```

**Notes:**

- Use `credential_id` from the list endpoint
- Users can delete their own passkeys only
- Returns 404 if passkey not found or doesn't belong to user
- Returns 401 if not authenticated

## TypeScript Integration

### API Client

```typescript
// api/auth.ts
const API_BASE = "https://api.sctcoding.club";

interface User {
  id: string;
  email: string;
  name: string;
  etlab_username?: string;
  profile_photo_url?: string;
  created_at?: number;
}

interface AuthResponse {
  success: boolean;
  data?: {
    session_id: string;
    user: User;
  };
  error?: string;
}

class AuthAPI {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem("auth_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  async verifyEtLab(username: string) {
    const response = await this.request<{
      success: boolean;
      data: {
        verification_token: string;
        user: Partial<User>;
      };
    }>("/api/v3/auth/etlab/verify", {
      method: "POST",
      body: JSON.stringify({ username }),
    });

    return response.data;
  }

  async signup(
    verificationToken: string,
    email: string,
    password: string,
    customPhoto?: string,
  ) {
    const response = await this.request<AuthResponse>("/api/v3/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        verification_token: verificationToken,
        email,
        password,
        profile_photo: customPhoto,
      }),
    });

    if (response.data) {
      this.token = response.data.session_id;
      localStorage.setItem("auth_token", this.token);
      return response.data.user;
    }

    throw new Error("Signup failed");
  }

  async login(email: string, password: string) {
    const response = await this.request<AuthResponse>("/api/v3/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (response.data) {
      this.token = response.data.session_id;
      localStorage.setItem("auth_token", this.token);
      return response.data.user;
    }

    throw new Error("Login failed");
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.token) return null;

    try {
      const response = await this.request<{ success: boolean; data: User }>(
        "/api/v3/auth/me",
      );
      return response.data;
    } catch {
      this.logout();
      return null;
    }
  }

  async updateProfile(updates: {
    name?: string;
    profile_photo?: string | null;
    profile_photo_filename?: string;
  }): Promise<User> {
    const response = await this.request<{
      success: boolean;
      data: User;
      message: string;
    }>("/api/v3/auth/profile", {
      method: "PUT",
      body: JSON.stringify(updates),
    });

    return response.data;
  }

  async listPasskeys(): Promise<
    Array<{
      id: string;
      credential_id: string;
      device_name: string | null;
      created_at: number;
      last_used_at: number | null;
    }>
  > {
    const response = await this.request<{
      success: boolean;
      data: Array<{
        id: string;
        credential_id: string;
        device_name: string | null;
        created_at: number;
        last_used_at: number | null;
      }>;
    }>("/api/v3/auth/passkeys");

    return response.data;
  }

  async deletePasskey(credentialId: string): Promise<void> {
    await this.request<{ success: boolean; message: string }>(
      `/api/v3/auth/passkeys/${credentialId}`,
      {
        method: "DELETE",
      },
    );
  }

  logout() {
    this.token = null;
    localStorage.removeItem("auth_token");

    // Optionally notify server (for session-based tokens)
    fetch(`${API_BASE}/api/v3/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
    }).catch(() => {});
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }
}

export const authAPI = new AuthAPI();
```

### React Hook

```typescript
// hooks/useAuth.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../api/auth';

interface User {
  id: string;
  email: string;
  name: string;
  etlab_username?: string;
  profile_photo_url?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  signup: (
    verificationToken: string,
    email: string,
    password: string,
    customPhoto?: string
  ) => Promise<void>;
  updateProfile: (updates: {
    name?: string;
    profile_photo?: string | null;
    profile_photo_filename?: string;
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authAPI.getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const user = await authAPI.login(email, password);
    setUser(user);
  };

  const signup = async (
    verificationToken: string,
    email: string,
    password: string,
    customPhoto?: string
  ) => {
    const user = await authAPI.signup(verificationToken, email, password, customPhoto);
    setUser(user);
  };

  const updateProfile = async (updates: {
    name?: string;
    profile_photo?: string | null;
    profile_photo_filename?: string;
  }) => {
    const updatedUser = await authAPI.updateProfile(updates);
    setUser(updatedUser);
  };

  const refreshUser = async () => {
    const currentUser = await authAPI.getCurrentUser();
    setUser(currentUser);
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, signup, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Usage in Components

```typescript
// pages/Login.tsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
}
```

```typescript
// pages/Signup.tsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../api/auth';

export function SignupPage() {
  const [step, setStep] = useState<'etlab' | 'complete'>('etlab');
  const [etlabUsername, setEtlabUsername] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signup } = useAuth();

  const handleEtLabVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await authAPI.verifyEtLab(etlabUsername);
    setVerificationToken(data.verification_token);
    setUserData(data.user);
    setStep('complete');
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    await signup(verificationToken, email, password);
  };

  if (step === 'etlab') {
    return (
      <form onSubmit={handleEtLabVerify}>
        <h2>Verify with EtLab</h2>
        <input
          value={etlabUsername}
          onChange={(e) => setEtlabUsername(e.target.value)}
          placeholder="EtLab Username"
          required
        />
        <button type="submit">Verify</button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCompleteSignup}>
      <h2>Complete Signup</h2>
      <p>Welcome, {userData?.name}!</p>
      {userData?.profile_photo_url && (
        <img src={userData.profile_photo_url} alt="Profile" />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Complete Signup</button>
    </form>
  );
}
```

```typescript
// pages/ProfileEdit.tsx
import { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';

export function ProfileEditPage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFilename, setPhotoFilename] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      setPhotoFilename(file.name);
      setError('');
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoFilename('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updates: any = {};

      // Only include fields that changed
      if (name !== user?.name) {
        updates.name = name;
      }

      if (photo !== null) {
        updates.profile_photo = photo;
        updates.profile_photo_filename = photoFilename;
      }

      if (Object.keys(updates).length === 0) {
        setError('No changes to save');
        return;
      }

      await updateProfile(updates);
      setSuccess('Profile updated successfully!');
      setPhoto(null); // Reset photo state after successful upload
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-edit">
      <h2>Edit Profile</h2>

      <div className="current-profile">
        {user?.profile_photo_url && (
          <img
            src={user.profile_photo_url}
            alt={user.name}
            className="profile-avatar"
          />
        )}
        <p>{user?.email}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="photo">Profile Photo</label>
          <input
            id="photo"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
          />
          {photo && (
            <div className="photo-preview">
              <img src={photo} alt="Preview" />
              <button type="button" onClick={handleRemovePhoto}>
                Remove
              </button>
            </div>
          )}
          <small>Max 5MB, JPG, PNG, GIF</small>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
```

```typescript
// pages/PasskeyManagement.tsx
import { useState, useEffect } from 'react';
import { authAPI } from '../api/auth';

interface Passkey {
  id: string;
  credential_id: string;
  device_name: string | null;
  created_at: number;
  last_used_at: number | null;
}

export function PasskeyManagementPage() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPasskeys = async () => {
    try {
      setLoading(true);
      const data = await authAPI.listPasskeys();
      setPasskeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passkeys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPasskeys();
  }, []);

  const handleDelete = async (credentialId: string, deviceName: string | null) => {
    if (!confirm(`Delete passkey for ${deviceName || 'this device'}?`)) {
      return;
    }

    try {
      await authAPI.deletePasskey(credentialId);
      await loadPasskeys(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete passkey');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div>Loading passkeys...</div>;
  }

  return (
    <div className="passkey-management">
      <h2>Manage Passkeys</h2>
      <p>Passkeys allow you to sign in without a password using biometrics or device PIN.</p>

      {error && <div className="error">{error}</div>}

      {passkeys.length === 0 ? (
        <div className="empty-state">
          <p>No passkeys registered yet.</p>
          <button onClick={() => window.location.href = '/passkey/register'}>
            Add Passkey
          </button>
        </div>
      ) : (
        <div className="passkey-list">
          {passkeys.map((passkey) => (
            <div key={passkey.id} className="passkey-item">
              <div className="passkey-info">
                <h3>{passkey.device_name || 'Unnamed Device'}</h3>
                <p className="meta">
                  Created: {formatDate(passkey.created_at)}
                </p>
                {passkey.last_used_at && (
                  <p className="meta">
                    Last used: {formatDate(passkey.last_used_at)}
                  </p>
                )}
              </div>
              <button
                className="delete-button"
                onClick={() => handleDelete(passkey.credential_id, passkey.device_name)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Profile Photo Handling

### Profile Photo Options

When updating or setting a profile photo, you have three options:

1. **Base64 Encoded Image** (Recommended for uploads)

   ```typescript
   profile_photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg...";
   ```

   - Automatically uploaded to R2 storage
   - Validated (max 5MB)
   - Returns public URL

2. **External URL**

   ```typescript
   profile_photo: "https://example.com/photo.jpg";
   ```

   - Stored as-is in database
   - No upload to R2

3. **Remove Photo**

   ```typescript
   profile_photo: null;
   ```

   - Removes current profile photo
   - Sets field to NULL

4. **Keep Current Photo**
   - Simply omit the `profile_photo` field from the request

### Using EtLab Photo

By default, users get their profile photo from EtLab during signup. No additional handling needed.

### Custom Photo Upload

```typescript
async function uploadCustomPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Usage
const file = document.querySelector('input[type="file"]').files[0];
const base64Photo = await uploadCustomPhoto(file);
await authAPI.signup(token, email, password, base64Photo);
```

Photos are automatically:

- Stored in Cloudflare R2
- Validated (max 5MB)
- Served with public URLs
- Optimized for web delivery

### Best Practices for Profile Photos

**Client-side validation:**

```typescript
function validateProfilePhoto(file: File): string | null {
  // Check file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return "Image must be less than 5MB";
  }

  // Check file type
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return "Please select a valid image (JPG, PNG, GIF, WebP)";
  }

  return null; // Valid
}

// Usage
const file = fileInput.files[0];
const error = validateProfilePhoto(file);
if (error) {
  alert(error);
  return;
}
```

**Image optimization (optional but recommended):**

```typescript
async function optimizeImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      // Create canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Calculate dimensions
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      const base64 = canvas.toDataURL("image/jpeg", 0.85);
      resolve(base64);
    };

    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Usage
const optimized = await optimizeImage(file);
await authAPI.updateProfile({
  profile_photo: optimized,
  profile_photo_filename: file.name,
});
```

## Validation & Error Handling

### Profile Update Validation

**Frontend validation:**

```typescript
function validateProfileUpdate(name?: string, photo?: File | null) {
  const errors: string[] = [];

  // Name validation
  if (name !== undefined) {
    if (name.trim().length === 0) {
      errors.push("Name cannot be empty");
    }
    if (name.length > 100) {
      errors.push("Name must be less than 100 characters");
    }
  }

  // Photo validation
  if (photo instanceof File) {
    const photoError = validateProfilePhoto(photo);
    if (photoError) errors.push(photoError);
  }

  return errors;
}
```

**Backend errors:**
| Error | Reason | Solution |
|-------|--------|----------|
| `No valid fields to update` | Request doesn't include any updatable fields | Include at least one field: name or profile_photo |
| `Name cannot be empty` | Provided name is empty string | Provide a valid name |
| `Failed to upload profile photo` | R2 upload failed | Check image format, try again |
| `Invalid or expired token` | Authentication failed | User needs to login again |

### Passkey Management Validation

**Delete passkey errors:**
| Error | Reason | Solution |
|-------|--------|----------|
| `Passkey not found` | Credential ID doesn't exist or doesn't belong to user | Refresh passkey list |
| `Invalid or expired token` | Authentication failed | User needs to login again |

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common errors:

| Status | Error                    | Meaning                    |
| ------ | ------------------------ | -------------------------- |
| 400    | Invalid credentials      | Wrong email/password       |
| 401    | Invalid or expired token | Re-authentication required |
| 404    | User not found           | Account doesn't exist      |
| 409    | Email already registered | Use different email        |
| 500    | Internal server error    | Server issue, retry later  |

## Security Best Practices

### Token Storage

**Recommended: sessionStorage** (cleared on tab close)

```typescript
sessionStorage.setItem("auth_token", token);
```

**Alternative: localStorage** (persists across sessions)

```typescript
localStorage.setItem("auth_token", token);
```

**Most Secure: HttpOnly Cookies** (requires server configuration)

```typescript
// Server sets: Set-Cookie: auth_token=...; HttpOnly; Secure; SameSite=Strict
// Client: automatic, no JavaScript access
```

### HTTPS Only

Always use HTTPS in production. Never send tokens over HTTP.

### Token Expiration

Tokens expire after 7 days. Handle expiration gracefully:

```typescript
async function requestWithAuth(endpoint: string) {
  try {
    return await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    if (error.status === 401) {
      // Token expired, redirect to login
      window.location.href = "/login";
    }
    throw error;
  }
}
```

## Testing

### Manual Testing

Use the HTTP test file: [test-v3-passkey.http](../test-v3-passkey.http)

### Automated Testing

```typescript
describe("Auth Flow", () => {
  it("should complete signup flow", async () => {
    // 1. Verify EtLab
    const verification = await authAPI.verifyEtLab("testuser");
    expect(verification.verification_token).toBeDefined();

    // 2. Complete signup
    const user = await authAPI.signup(
      verification.verification_token,
      "test@example.com",
      "password123",
    );
    expect(user.email).toBe("test@example.com");

    // 3. Verify authentication
    const currentUser = await authAPI.getCurrentUser();
    expect(currentUser?.id).toBe(user.id);
  });

  it("should update profile", async () => {
    // Login first
    await authAPI.login("test@example.com", "password123");

    // Update name
    const updated = await authAPI.updateProfile({ name: "New Name" });
    expect(updated.name).toBe("New Name");

    // Verify update persisted
    const user = await authAPI.getCurrentUser();
    expect(user?.name).toBe("New Name");
  });

  it("should manage passkeys", async () => {
    // Login
    await authAPI.login("test@example.com", "password123");

    // List passkeys (should be empty initially)
    const passkeys = await authAPI.listPasskeys();
    expect(passkeys).toHaveLength(0);

    // Register a passkey would require WebAuthn mocking
    // Delete would follow similar pattern
  });
});
```

## Feature Summary

### Profile Management 🆕

**What you can do:**

- ✅ Get current user information (`GET /auth/me`)
- ✅ Update display name (`PUT /auth/profile`)
- ✅ Upload custom profile photo (base64 → R2 storage)
- ✅ Use external photo URL
- ✅ Remove profile photo
- ✅ Automatic photo optimization and storage

**Key benefits:**

- Simple REST API - no complex SDK needed
- Flexible photo handling (base64, URL, or removal)
- Automatic R2 storage with CDN delivery
- Only update what changed - partial updates supported
- Type-safe with Zod validation

### Passkey Management 🆕

**What you can do:**

- ✅ List all registered passkeys for current user
- ✅ See device names, creation dates, last used dates
- ✅ Delete passkeys you no longer need
- ✅ Manage security across multiple devices

**Key benefits:**

- Complete visibility into authentication devices
- Easy security management
- Remove compromised or old devices
- Track authentication activity
- Works with WebAuthn passkey registration/login

### Combined Power 💪

Build complete user account management:

```typescript
// Complete profile page
const { user, updateProfile } = useAuth();
const passkeys = await authAPI.listPasskeys();

// User can:
// 1. View their complete profile
// 2. Edit name and photo
// 3. Manage passkeys
// 4. Control their security
```

## Migration from Old API

If migrating from previous API versions:

1. Update base URL to use `/api/v3/`
2. Change session handling to use Bearer tokens
3. Update signup flow to two-step process
4. Implement EtLab verification
5. Test with new endpoints

## Related Documentation

- 📖 [JWT Authentication](./JWT_AUTHENTICATION.md) - Deep dive into JWT tokens
- 📖 [Session Management](./SESSION_MANAGEMENT.md) - JWT vs Session comparison
- 📖 [Passkey Implementation](./PASSKEY_IMPLEMENTATION.md) - WebAuthn integration
- 📖 [V3 API Summary](./V3_IMPLEMENTATION_SUMMARY.md) - Complete API overview

## Support

For issues or questions:

- Check error messages in API responses
- Review documentation above
- Test with HTTP client first
- Verify token format and expiration
