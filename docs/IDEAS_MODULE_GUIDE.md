# Event Ideas (Host Your Own Events) - Frontend Guide

## Overview

The Event Ideas module allows users to propose, vote on, and discuss event ideas for the Coding Club. This community-driven feature helps democratize event planning by letting members suggest and support events they'd like to see.

## Key Features

- 📝 **Create Ideas** - Submit event proposals with title and description
- 🗳️ **Vote System** - Upvote ideas you support (verified users only)
- 💬 **Comments** - Discuss ideas with other members
- 📊 **Sorting** - Ideas sorted by vote count (most popular first)
- 🔒 **Verification** - Only EtLab verified users can vote

## API Endpoints

### Base URL

```
https://api.sctcoding.club/api/v3/ideas
```

### Endpoints Summary

| Method | Endpoint                          | Auth     | Description                   |
| ------ | --------------------------------- | -------- | ----------------------------- |
| GET    | `/ideas`                          | Optional | List all ideas (paginated)    |
| GET    | `/ideas/:id`                      | Optional | Get single idea details       |
| POST   | `/ideas`                          | Required | Create new idea               |
| POST   | `/ideas/:id/vote`                 | Required | Toggle vote on idea           |
| GET    | `/ideas/:id/comments`             | No       | Get idea comments (paginated) |
| POST   | `/ideas/:id/comments`             | Required | Add comment to idea           |
| DELETE | `/ideas/:id/comments/:comment_id` | Required | Delete own comment            |

---

## 1. List Ideas

Get paginated list of event ideas, sorted by vote count (most voted first).

### Request

```typescript
GET /api/v3/ideas?page=1&limit=20
```

**Query Parameters:**

- `page` (number, default: 1) - Page number
- `limit` (number, default: 20, max: 50) - Items per page

**Authentication:** Optional (shows `has_voted` if authenticated)

### Response

```typescript
{
  "success": true,
  "data": {
    "ideas": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "AI/ML Workshop Series",
        "description": "A hands-on workshop series covering machine learning basics...",
        "vote_count": 42,
        "comment_count": 8,
        "has_voted": true, // Only if authenticated
        "created_at": 1705910400,
        "updated_at": 1705910400,
        "author": {
          "id": "user-id",
          "name": "John Doe",
          "profile_photo_url": "https://...",
          "is_verified": true
        }
      }
    ],
    "total": 156,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

### Implementation

```typescript
async function fetchIdeas(page = 1, limit = 20) {
  const accessToken = localStorage.getItem("access_token");
  const headers: HeadersInit = {};

  // Include auth if available to show vote status
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `https://api.sctcoding.club/api/v3/ideas?page=${page}&limit=${limit}`,
    { headers },
  );

  return response.json();
}
```

### React Example

```typescript
import { useState, useEffect } from 'react';

export function IdeasList() {
  const [ideas, setIdeas] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadIdeas();
  }, [page]);

  const loadIdeas = async () => {
    setLoading(true);
    try {
      const data = await fetchIdeas(page, 20);
      if (data.success) {
        setIdeas(data.data.ideas);
        setTotalPages(data.data.total_pages);
      }
    } catch (error) {
      console.error('Failed to load ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {ideas.map(idea => (
            <IdeaCard key={idea.id} idea={idea} onVote={loadIdeas} />
          ))}

          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
```

---

## 2. Get Single Idea

Retrieve detailed information about a specific idea.

### Request

```typescript
GET /api/v3/ideas/:id
```

**Authentication:** Optional (shows `has_voted` if authenticated)

### Response

```typescript
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "AI/ML Workshop Series",
    "description": "Full description of the event idea...",
    "vote_count": 42,
    "comment_count": 8,
    "has_voted": false,
    "created_at": 1705910400,
    "updated_at": 1705910400,
    "author": {
      "id": "user-id",
      "name": "John Doe",
      "profile_photo_url": "https://...",
      "is_verified": true
    }
  }
}
```

### Implementation

```typescript
async function fetchIdeaById(ideaId: string) {
  const accessToken = localStorage.getItem("access_token");
  const headers: HeadersInit = {};

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `https://api.sctcoding.club/api/v3/ideas/${ideaId}`,
    { headers },
  );

  return response.json();
}
```

---

## 3. Create Idea

Submit a new event idea. Requires authentication.

### Request

```typescript
POST /api/v3/ideas
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "AI/ML Workshop Series",
  "description": "A comprehensive workshop series covering machine learning fundamentals..."
}
```

**Validation:**

- `title`: Minimum 3 characters
- `description`: Minimum 10 characters

### Response

```typescript
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "AI/ML Workshop Series",
    "description": "A comprehensive workshop series...",
    "vote_count": 0,
    "comment_count": 0,
    "has_voted": false,
    "created_at": 1705910400,
    "updated_at": 1705910400,
    "author": {
      "id": "user-id",
      "name": "John Doe",
      "profile_photo_url": "https://...",
      "is_verified": true
    }
  },
  "message": "Idea created successfully"
}
```

### Implementation

```typescript
async function createIdea(title: string, description: string) {
  const accessToken = localStorage.getItem("access_token");

  const response = await fetch("https://api.sctcoding.club/api/v3/ideas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title, description }),
  });

  return response.json();
}
```

### React Example

```typescript
export function CreateIdeaForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (title.length < 3) {
      alert('Title must be at least 3 characters');
      return;
    }

    if (description.length < 10) {
      alert('Description must be at least 10 characters');
      return;
    }

    setLoading(true);
    try {
      const data = await createIdea(title, description);

      if (data.success) {
        alert('Idea created successfully!');
        setTitle('');
        setDescription('');
        // Redirect to ideas list or show the new idea
      } else {
        alert(data.error || 'Failed to create idea');
      }
    } catch (error) {
      console.error('Create idea error:', error);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Event title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        minLength={3}
        required
      />

      <textarea
        placeholder="Describe your event idea..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        minLength={10}
        rows={5}
        required
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Submit Idea'}
      </button>
    </form>
  );
}
```

---

## 4. Vote on Idea

Toggle vote on an idea (upvote if not voted, remove vote if already voted).

**⚠️ Important:** Only EtLab verified users can vote (`is_verified: true`)

### Request

```typescript
POST /api/v3/ideas/:id/vote
Authorization: Bearer <access_token>
```

### Response

```typescript
{
  "success": true,
  "data": {
    "voted": true, // true if vote added, false if removed
    "vote_count": 43
  },
  "message": "Vote added" // or "Vote removed"
}
```

### Error Response (Not Verified)

```typescript
{
  "success": false,
  "error": "Only EtLab verified users can vote"
}
```

### Implementation

```typescript
async function toggleVote(ideaId: string) {
  const accessToken = localStorage.getItem("access_token");

  const response = await fetch(
    `https://api.sctcoding.club/api/v3/ideas/${ideaId}/vote`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.json();
}
```

### React Example

```typescript
export function VoteButton({ ideaId, hasVoted, voteCount, isVerified }) {
  const [voted, setVoted] = useState(hasVoted);
  const [count, setCount] = useState(voteCount);
  const [loading, setLoading] = useState(false);

  const handleVote = async () => {
    if (!isVerified) {
      alert('Only EtLab verified users can vote. Please verify your account.');
      return;
    }

    setLoading(true);
    try {
      const data = await toggleVote(ideaId);

      if (data.success) {
        setVoted(data.data.voted);
        setCount(data.data.vote_count);
      } else {
        alert(data.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Vote error:', error);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleVote}
      disabled={loading || !isVerified}
      className={voted ? 'voted' : ''}
      title={!isVerified ? 'Verify your account to vote' : ''}
    >
      {voted ? '❤️' : '🤍'} {count}
    </button>
  );
}
```

---

## 5. Get Idea Comments

Retrieve paginated comments for a specific idea.

### Request

```typescript
GET /api/v3/ideas/:id/comments?page=1&limit=20
```

**Query Parameters:**

- `page` (number, default: 1) - Page number
- `limit` (number, default: 20, max: 50) - Items per page

**Authentication:** Not required

### Response

```typescript
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "comment-id",
        "idea_id": "idea-id",
        "user_id": "user-id",
        "comment": "Great idea! I'd love to attend this workshop.",
        "created_at": 1705910400,
        "updated_at": 1705910400,
        "author": {
          "id": "user-id",
          "name": "Jane Smith",
          "profile_photo_url": "https://...",
          "is_verified": true
        }
      }
    ],
    "total": 8,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

### Implementation

```typescript
async function fetchIdeaComments(ideaId: string, page = 1, limit = 20) {
  const response = await fetch(
    `https://api.sctcoding.club/api/v3/ideas/${ideaId}/comments?page=${page}&limit=${limit}`,
  );

  return response.json();
}
```

---

## 6. Add Comment

Post a comment on an idea. Requires authentication.

### Request

```typescript
POST /api/v3/ideas/:id/comments
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "comment": "Great idea! I'd love to attend this workshop."
}
```

### Response

```typescript
{
  "success": true,
  "data": {
    "id": "comment-id",
    "idea_id": "idea-id",
    "user_id": "user-id",
    "comment": "Great idea! I'd love to attend this workshop.",
    "created_at": 1705910400,
    "updated_at": 1705910400,
    "author": {
      "id": "user-id",
      "name": "Jane Smith",
      "profile_photo_url": "https://...",
      "is_verified": true
    }
  },
  "message": "Comment added successfully"
}
```

### Implementation

```typescript
async function addComment(ideaId: string, comment: string) {
  const accessToken = localStorage.getItem("access_token");

  const response = await fetch(
    `https://api.sctcoding.club/api/v3/ideas/${ideaId}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ comment }),
    },
  );

  return response.json();
}
```

### React Example

```typescript
export function CommentForm({ ideaId, onCommentAdded }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!comment.trim()) {
      alert('Comment cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const data = await addComment(ideaId, comment);

      if (data.success) {
        setComment('');
        onCommentAdded(data.data); // Update parent component
      } else {
        alert(data.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Comment error:', error);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        placeholder="Share your thoughts..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Posting...' : 'Post Comment'}
      </button>
    </form>
  );
}
```

---

## 7. Delete Comment

Delete your own comment. Users can only delete their own comments.

### Request

```typescript
DELETE /api/v3/ideas/:id/comments/:comment_id
Authorization: Bearer <access_token>
```

### Response

```typescript
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

### Error Response (Not Owner)

```typescript
{
  "success": false,
  "error": "You can only delete your own comments"
}
```

### Implementation

```typescript
async function deleteComment(ideaId: string, commentId: string) {
  const accessToken = localStorage.getItem("access_token");

  const response = await fetch(
    `https://api.sctcoding.club/api/v3/ideas/${ideaId}/comments/${commentId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.json();
}
```

### React Example

```typescript
export function CommentItem({ comment, currentUserId, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;

    setDeleting(true);
    try {
      const data = await deleteComment(comment.idea_id, comment.id);

      if (data.success) {
        onDelete(comment.id); // Update parent component
      } else {
        alert(data.error || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('An error occurred');
    } finally {
      setDeleting(false);
    }
  };

  const isOwner = comment.user_id === currentUserId;

  return (
    <div className="comment">
      <div className="comment-header">
        <img src={comment.author.profile_photo_url} alt={comment.author.name} />
        <span>{comment.author.name}</span>
        {comment.author.is_verified && <span>✓</span>}
      </div>

      <p>{comment.comment}</p>

      {isOwner && (
        <button onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      )}
    </div>
  );
}
```

---

## Complete Example: Idea Details Page

```typescript
import { useState, useEffect } from 'react';

export function IdeaDetailsPage({ ideaId }) {
  const [idea, setIdea] = useState(null);
  const [comments, setComments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [ideaId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load current user
      const userResponse = await fetch(
        'https://api.sctcoding.club/api/v3/auth/me',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );
      const userData = await userResponse.json();
      if (userData.success) {
        setCurrentUser(userData.data);
      }

      // Load idea
      const ideaData = await fetchIdeaById(ideaId);
      if (ideaData.success) {
        setIdea(ideaData.data);
      }

      // Load comments
      const commentsData = await fetchIdeaComments(ideaId);
      if (commentsData.success) {
        setComments(commentsData.data.comments);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    const data = await toggleVote(ideaId);
    if (data.success) {
      setIdea(prev => ({
        ...prev,
        has_voted: data.data.voted,
        vote_count: data.data.vote_count,
      }));
    }
  };

  const handleCommentAdded = (newComment) => {
    setComments(prev => [newComment, ...prev]);
    setIdea(prev => ({
      ...prev,
      comment_count: prev.comment_count + 1,
    }));
  };

  const handleCommentDeleted = (commentId) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    setIdea(prev => ({
      ...prev,
      comment_count: prev.comment_count - 1,
    }));
  };

  if (loading) return <div>Loading...</div>;
  if (!idea) return <div>Idea not found</div>;

  return (
    <div className="idea-details">
      <div className="idea-header">
        <h1>{idea.title}</h1>

        <div className="idea-meta">
          <img src={idea.author.profile_photo_url} alt={idea.author.name} />
          <span>{idea.author.name}</span>
          {idea.author.is_verified && <span>✓</span>}
        </div>
      </div>

      <p className="idea-description">{idea.description}</p>

      <div className="idea-stats">
        <VoteButton
          ideaId={idea.id}
          hasVoted={idea.has_voted}
          voteCount={idea.vote_count}
          isVerified={currentUser?.is_verified}
          onVote={handleVote}
        />
        <span>{idea.comment_count} comments</span>
      </div>

      <div className="comments-section">
        <h2>Comments</h2>

        {currentUser && (
          <CommentForm
            ideaId={ideaId}
            onCommentAdded={handleCommentAdded}
          />
        )}

        <div className="comments-list">
          {comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUser?.id}
              onDelete={handleCommentDeleted}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Best Practices

### 1. Authentication State Management

Always check authentication status before showing create/vote/comment actions:

```typescript
const isAuthenticated = !!localStorage.getItem("access_token");
const canVote = isAuthenticated && currentUser?.is_verified;
```

### 2. Optimistic UI Updates

Update UI immediately for better UX, then sync with server:

```typescript
// Optimistic vote
setVoted(!voted);
setCount(voted ? count - 1 : count + 1);

// Then sync
const data = await toggleVote(ideaId);
if (!data.success) {
  // Revert on error
  setVoted(voted);
  setCount(count);
}
```

### 3. Pagination

Implement infinite scroll or "Load More" for better UX:

```typescript
const loadMore = async () => {
  const nextPage = page + 1;
  const data = await fetchIdeas(nextPage);

  if (data.success) {
    setIdeas((prev) => [...prev, ...data.data.ideas]);
    setPage(nextPage);
  }
};
```

### 4. Error Handling

Provide clear feedback for common errors:

```typescript
if (error.includes("verified users")) {
  // Show verification prompt
  showVerificationModal();
} else if (error.includes("Authentication required")) {
  // Redirect to login
  navigate("/login");
} else {
  // Generic error
  showErrorToast(error);
}
```

### 5. Real-time Updates

Consider polling or WebSocket for live vote/comment counts:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    refreshIdeaCounts();
  }, 30000); // Every 30 seconds

  return () => clearInterval(interval);
}, []);
```

---

## Error Responses

### Common Errors

**401 Unauthorized**

```json
{
  "success": false,
  "error": "Authentication required"
}
```

**403 Forbidden (Voting)**

```json
{
  "success": false,
  "error": "Only EtLab verified users can vote"
}
```

**404 Not Found**

```json
{
  "success": false,
  "error": "Idea not found"
}
```

**400 Validation Error**

```json
{
  "success": false,
  "error": "Title must be at least 3 characters"
}
```

---

## Testing Checklist

- [ ] List ideas without authentication
- [ ] List ideas with authentication (shows `has_voted`)
- [ ] Pagination works correctly
- [ ] Create idea with valid data
- [ ] Validation errors show for invalid data
- [ ] Vote toggle works (add/remove)
- [ ] Unverified users cannot vote
- [ ] Comments load and paginate correctly
- [ ] Add comment as authenticated user
- [ ] Delete own comment
- [ ] Cannot delete other users' comments
- [ ] Vote counts update correctly
- [ ] Comment counts update correctly
