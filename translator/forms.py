from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.models import User


class LoginForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["username"].widget.attrs.update({"placeholder": "Your username", "autocomplete": "username", "autofocus": True})
        self.fields["password"].widget.attrs.update({"placeholder": "Your password", "autocomplete": "current-password"})


class SignupForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["username"].help_text = ""
        self.fields["username"].widget.attrs.update({"placeholder": "Your username", "autocomplete": "username"})
        self.fields["password1"].label = "Password"
        self.fields["password1"].help_text = ""
        self.fields["password1"].widget.attrs.update({"placeholder": "At least 6 characters", "autocomplete": "new-password"})
        self.fields["password2"].label = "Confirm password"
        self.fields["password2"].help_text = ""
        self.fields["password2"].widget.attrs.update({"placeholder": "Repeat your password", "autocomplete": "new-password"})
