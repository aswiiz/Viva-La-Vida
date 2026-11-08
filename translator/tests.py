from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse

from . import models as tmodels


class AuthenticatedModelTest(TestCase):
    """Model-related tests (Gesture, UserProfile, RecognitionHistory)."""

    def setUp(self):
        import uuid
        self.user = User.objects.create_user(
            f'testuser{str(uuid.uuid4())[:8]}', 'pass12345', 'test@example.com'
        )

    def test_user_profile_created_on_first_access(self):
        """A UserProfile is auto-created when first accessed."""
        profile = self.user.profile
        self.assertIsInstance(profile, tmodels.UserProfile)

    def test_gesture_model(self):
        g = tmodels.Gesture.objects.create(
            slug='hello',
            name='Hello',
            meaning='Wave hello',
            description='Raise hand palm forward',
            example='Hello, how are you?',
            category='greetings',
            is_supported=True,
        )
        self.assertEqual(str(g), 'Hello (hello)')
        self.assertTrue(g.is_supported)
        self.assertFalse(g.is_demo)

    def test_recognition_history(self):
        gesture = tmodels.Gesture.objects.create(
            slug='test', name='Test', meaning='A test sign', category='demo'
        )
        h = tmodels.RecognitionHistory.objects.create(
            user=self.user,
            gesture=gesture,
            label='hello',
            confidence=0.95,
            device='Chrome',
        )
        self.assertEqual(h.label, 'hello')
        self.assertEqual(round(h.confidence, 2), 0.95)
        self.assertEqual(h.user, self.user)

    def test_profile_page_redirects_unauthenticated(self):
        from django.test import Client
        c = Client(HTTP_HOST='localhost')
        r = c.get('/profile/')
        self.assertEqual(r.status_code, 302)
        self.assertIn('signin', r.url)

    def test_user_profile_created(self):
        """A UserProfile is auto-created on first access via get_or_create."""
        profile, created = tmodels.UserProfile.objects.get_or_create(user=self.user)
        self.assertTrue(created)
        self.assertIsInstance(profile, tmodels.UserProfile)
        self.assertEqual(profile.user, self.user)

    def test_user_profile_created_on_first_access(self):
        """A UserProfile is auto-created when first accessed."""
        profile, created = tmodels.UserProfile.objects.get_or_create(user=self.user)
        self.assertTrue(created)
        self.assertIsInstance(profile, tmodels.UserProfile)
        self.assertEqual(profile.user, self.user)


class ViewTest(TestCase):
    """Frontend and API view tests."""

    def setUp(self):
        self.client = Client(HTTP_HOST='localhost')

    def test_homepage_redirects_to_signin(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/signin/', response.url)

    def test_signup_page(self):
        response = self.client.get('/signup/')
        self.assertEqual(response.status_code, 200)

    def test_signin_page(self):
        response = self.client.get('/signin/')
        self.assertEqual(response.status_code, 200)

    def test_guest_mode(self):
        response = self.client.post('/guest/')
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/')
        # Homepage should now render for the guest
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)

    def test_dictionary_page(self):
        response = self.client.get('/dictionary/')
        self.assertEqual(response.status_code, 200)

    def test_profile_page_authenticated(self):
        import uuid
        user = User.objects.create_user(f'profileuser{str(uuid.uuid4())[:8]}', 'pass12345', 'test@example.com')
        self.client.force_login(user)
        response = self.client.get('/profile/')
        self.assertEqual(response.status_code, 200)

    def test_profile_page_unauthenticated_redirects(self):
        response = self.client.get('/profile/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('signin', response.url)

    def test_recognition_api_requires_auth(self):
        response = self.client.post(
            '/api/recognize/',
            data='{}',
            content_type='application/json',
        )
        # Unauthenticated requests return 401 Unauthorized
        self.assertEqual(response.status_code, 401)

    def test_dictionary_api(self):
        response = self.client.get('/api/dictionary/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('gestures', data)
        self.assertIn('count', data)

    def test_logout(self):
        import uuid
        user = User.objects.create_user(f'logouttest{str(uuid.uuid4())[:8]}', 'pass12345', 'test@example.com')
        self.client.force_login(user)
        response = self.client.post('/logout/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/signin/', response.url)
