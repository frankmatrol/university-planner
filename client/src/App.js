import { useEffect, useMemo, useState } from "react";
import "./App.css";

const emptySignupForm = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  program: "",
  wants_option: false,
  wants_minor: false,
  desired_option: [],
  desired_minor: [],
  expected_graduation_year: "",
  current_term: "",
};

const emptyLoginForm = {
  email: "",
  password: "",
};

function normalizeSelections(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getCombinedSelectionCount(formLike) {
  return (
    normalizeSelections(formLike.desired_option).length +
    normalizeSelections(formLike.desired_minor).length
  );
}

function getSignupErrors(form, isEngineeringProgram) {
  const errors = {};

  if (!form.first_name.trim()) errors.first_name = "First name is required.";
  if (!form.last_name.trim()) errors.last_name = "Last name is required.";
  if (!form.email.trim()) errors.email = "Email is required.";
  if (!form.password.trim()) errors.password = "Password is required.";
  if (!form.program) errors.program = "Program is required.";
  if (!form.expected_graduation_year)
    errors.expected_graduation_year = "Expected graduation year is required.";
  if (!form.current_term) errors.current_term = "Current term is required.";

  if (form.wants_option) {
    if (!isEngineeringProgram) {
      errors.program = "Options are currently limited to Engineering programs.";
    }
    if (form.desired_option.length === 0) {
      errors.desired_option = "Choose at least one option.";
    }
    if (form.desired_option.length > 3) {
      errors.desired_option = "You can choose at most 3 options.";
    }
  }

  if (form.wants_minor) {
    if (form.desired_minor.length === 0) {
      errors.desired_minor = "Choose at least one minor.";
    }
    if (form.desired_minor.length > 3) {
      errors.desired_minor = "You can choose at most 3 minors.";
    }
  }

  if (getCombinedSelectionCount(form) > 4) {
    errors.desired_option = "You can choose a combined total of at most 4 options/minors.";
    errors.desired_minor = "You can choose a combined total of at most 4 options/minors.";
  }

  return errors;
}

function getLoginErrors(form) {
  const errors = {};
  if (!form.email.trim()) errors.email = "Email is required.";
  if (!form.password.trim()) errors.password = "Password is required.";
  return errors;
}

function getProfileErrors(profile, isEngineeringProgram) {
  const errors = {};

  if (!profile.first_name?.trim()) errors.first_name = "First name is required.";
  if (!profile.last_name?.trim()) errors.last_name = "Last name is required.";
  if (!profile.program) errors.program = "Program is required.";
  if (!profile.expected_graduation_year)
    errors.expected_graduation_year = "Expected graduation year is required.";
  if (!profile.current_term) errors.current_term = "Current term is required.";

  const desiredOptions = normalizeSelections(profile.desired_option);
  const desiredMinors = normalizeSelections(profile.desired_minor);

  if (profile.wants_option) {
    if (!isEngineeringProgram) {
      errors.program = "Options are currently limited to Engineering programs.";
    }
    if (desiredOptions.length === 0) {
      errors.desired_option = "Choose at least one option.";
    }
    if (desiredOptions.length > 3) {
      errors.desired_option = "You can choose at most 3 options.";
    }
  }

  if (profile.wants_minor) {
    if (desiredMinors.length === 0) {
      errors.desired_minor = "Choose at least one minor.";
    }
    if (desiredMinors.length > 3) {
      errors.desired_minor = "You can choose at most 3 minors.";
    }
  }

  if (desiredOptions.length + desiredMinors.length > 4) {
    errors.desired_option = "You can choose a combined total of at most 4 options/minors.";
    errors.desired_minor = "You can choose a combined total of at most 4 options/minors.";
  }

  return errors;
}

function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onToggleValue,
  disabled,
  placeholder,
  invalid,
  errorText,
  helperText,
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="field field-full">
      <label>{label}</label>

      <button
        type="button"
        className={`dropdown-trigger ${invalid ? "invalid" : ""}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span className={selectedValues.length ? "" : "placeholder-text"}>
          {selectedValues.length ? selectedValues.join(", ") : placeholder}
        </span>
        <span className="dropdown-arrow">{isOpen ? "▴" : "▾"}</span>
      </button>

      {helperText && <p className="helper-text">{helperText}</p>}

      {isOpen && !disabled && (
        <div className="multi-dropdown-menu">
          {options.map((item) => {
            const checked = selectedValues.includes(item);

            return (
              <label key={item} className="multi-option-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleValue(item)}
                />
                <span>{item}</span>
              </label>
            );
          })}
        </div>
      )}

      {invalid && errorText && <p className="error-text">{errorText}</p>}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [signupForm, setSignupForm] = useState(emptySignupForm);
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [signupSubmitted, setSignupSubmitted] = useState(false);
  const [loginSubmitted, setLoginSubmitted] = useState(false);
  const [profileSubmitted, setProfileSubmitted] = useState(false);

  const [referenceData, setReferenceData] = useState({
    programs: [],
    engineeringPrograms: [],
    engineeringOptions: [],
    minors: [],
    termLabels: [],
  });

  const graduationYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 101 }, (_, index) => currentYear + index);
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [meRes, refRes] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/reference-data/signup", { credentials: "include" }),
        ]);

        const refData = await refRes.json();
        setReferenceData(refData);

        if (meRes.ok) {
          const meData = await meRes.json();
          setUser({
            ...meData,
            wants_option: !!meData.wants_option,
            wants_minor: !!meData.wants_minor,
            desired_option: normalizeSelections(meData.desired_option),
            desired_minor: normalizeSelections(meData.desired_minor),
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error(error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  const signupIsEngineering =
    signupForm.program &&
    referenceData.engineeringPrograms.includes(signupForm.program);

  const profileIsEngineering =
    user?.program &&
    referenceData.engineeringPrograms.includes(user.program);

  const signupErrors = getSignupErrors(signupForm, signupIsEngineering);
  const loginErrors = getLoginErrors(loginForm);
  const profileErrors = user ? getProfileErrors(user, profileIsEngineering) : {};

  const handleSignupChange = (event) => {
    const { name, value, type, checked } = event.target;

    setSignupForm((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "program") {
        const nextIsEngineering =
          referenceData.engineeringPrograms.includes(value);
        if (!nextIsEngineering) {
          next.wants_option = false;
          next.desired_option = [];
        }
      }

      if (name === "wants_option" && !checked) {
        next.desired_option = [];
      }

      if (name === "wants_minor" && !checked) {
        next.desired_minor = [];
      }

      return next;
    });
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileChange = (event) => {
    const { name, value, type, checked } = event.target;

    setUser((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "program") {
        const nextIsEngineering =
          referenceData.engineeringPrograms.includes(value);
        if (!nextIsEngineering) {
          next.wants_option = false;
          next.desired_option = [];
        }
      }

      if (name === "wants_option" && !checked) {
        next.desired_option = [];
      }

      if (name === "wants_minor" && !checked) {
        next.desired_minor = [];
      }

      return next;
    });
  };

  const toggleSignupSelection = (fieldName, value) => {
    setSignupForm((prev) => {
      const current = [...prev[fieldName]];
      const exists = current.includes(value);

      if (exists) {
        return {
          ...prev,
          [fieldName]: current.filter((item) => item !== value),
        };
      }

      if (current.length >= 3) {
        setMessage("You can choose at most 3 items in that list.");
        return prev;
      }

      if (getCombinedSelectionCount(prev) >= 4) {
        setMessage("You can choose a combined total of at most 4 options and minors.");
        return prev;
      }

      return {
        ...prev,
        [fieldName]: [...current, value],
      };
    });
  };

  const toggleProfileSelection = (fieldName, value) => {
    setUser((prev) => {
      const current = [...normalizeSelections(prev[fieldName])];
      const exists = current.includes(value);

      if (exists) {
        return {
          ...prev,
          [fieldName]: current.filter((item) => item !== value),
        };
      }

      if (current.length >= 3) {
        setMessage("You can choose at most 3 items in that list.");
        return prev;
      }

      if (getCombinedSelectionCount(prev) >= 4) {
        setMessage("You can choose a combined total of at most 4 options and minors.");
        return prev;
      }

      return {
        ...prev,
        [fieldName]: [...current, value],
      };
    });
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setSignupSubmitted(true);
    setMessage("");

    if (Object.keys(signupErrors).length > 0) {
      setMessage("Please fix the highlighted signup fields.");
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(signupForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      setUser({
        ...data.user,
        wants_option: !!data.user.wants_option,
        wants_minor: !!data.user.wants_minor,
        desired_option: normalizeSelections(data.user.desired_option),
        desired_minor: normalizeSelections(data.user.desired_minor),
      });
      setSignupForm(emptySignupForm);
      setSignupSubmitted(false);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginSubmitted(true);
    setMessage("");

    if (Object.keys(loginErrors).length > 0) {
      setMessage("Please fill in the login fields.");
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      setUser({
        ...data.user,
        wants_option: !!data.user.wants_option,
        wants_minor: !!data.user.wants_minor,
        desired_option: normalizeSelections(data.user.desired_option),
        desired_minor: normalizeSelections(data.user.desired_minor),
      });
      setLoginForm(emptyLoginForm);
      setLoginSubmitted(false);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleLogout = async () => {
    setMessage("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();
      setUser(null);
      setMessage(data.message);
    } catch (error) {
      setMessage("Logout failed.");
    }
  };

  const handleProfileUpdate = async (event) => {
    event.preventDefault();
    setProfileSubmitted(true);
    setMessage("");

    if (Object.keys(profileErrors).length > 0) {
      setMessage("Please fix the highlighted profile fields.");
      return;
    }

    try {
      const response = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(user),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Profile update failed");
      }

      setUser({
        ...data.user,
        wants_option: !!data.user.wants_option,
        wants_minor: !!data.user.wants_minor,
        desired_option: normalizeSelections(data.user.desired_option),
        desired_minor: normalizeSelections(data.user.desired_minor),
      });
      setProfileSubmitted(false);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <div className="card">
          <h1 className="title">University Planner</h1>
          <p className="subtle-text">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="card">
        <h1 className="title">University Planner</h1>
        <p className="subtle-text">Waterloo-only student planner.</p>

        {message && <div className="message-box">{message}</div>}

        {!user ? (
          <>
            <div className="mode-toggle">
              <button
                className={`mode-button ${mode === "login" ? "active" : ""}`}
                onClick={() => setMode("login")}
                type="button"
              >
                Login
              </button>
              <button
                className={`mode-button ${mode === "signup" ? "active" : ""}`}
                onClick={() => setMode("signup")}
                type="button"
              >
                Sign Up
              </button>
            </div>

            {mode === "signup" ? (
              <form className="form-grid" onSubmit={handleSignup}>
                <h2>Create Account</h2>

                <div className="field">
                  <label>First name</label>
                  <input
                    className={`input-control ${
                      signupSubmitted && signupErrors.first_name ? "invalid" : ""
                    }`}
                    name="first_name"
                    value={signupForm.first_name}
                    onChange={handleSignupChange}
                    placeholder="First Name"
                  />
                  {signupSubmitted && signupErrors.first_name && (
                    <p className="error-text">{signupErrors.first_name}</p>
                  )}
                </div>

                <div className="field">
                  <label>Last name</label>
                  <input
                    className={`input-control ${
                      signupSubmitted && signupErrors.last_name ? "invalid" : ""
                    }`}
                    name="last_name"
                    value={signupForm.last_name}
                    onChange={handleSignupChange}
                    placeholder="Last Name"
                  />
                  {signupSubmitted && signupErrors.last_name && (
                    <p className="error-text">{signupErrors.last_name}</p>
                  )}
                </div>

                <div className="field field-full">
                  <label>Email</label>
                  <input
                    className={`input-control ${
                      signupSubmitted && signupErrors.email ? "invalid" : ""
                    }`}
                    name="email"
                    type="email"
                    value={signupForm.email}
                    onChange={handleSignupChange}
                    placeholder="name@uwaterloo.ca or personal email"
                  />
                  {signupSubmitted && signupErrors.email && (
                    <p className="error-text">{signupErrors.email}</p>
                  )}
                </div>

                <div className="field field-full">
                  <label>Password</label>
                  <input
                    className={`input-control ${
                      signupSubmitted && signupErrors.password ? "invalid" : ""
                    }`}
                    name="password"
                    type="password"
                    value={signupForm.password}
                    onChange={handleSignupChange}
                    placeholder="Create a password"
                  />
                  {signupSubmitted && signupErrors.password && (
                    <p className="error-text">{signupErrors.password}</p>
                  )}
                </div>

                <div className="field field-full">
                  <label>Program</label>
                  <select
                    className={`input-control ${
                      signupSubmitted && signupErrors.program ? "invalid" : ""
                    }`}
                    name="program"
                    value={signupForm.program}
                    onChange={handleSignupChange}
                  >
                    <option value="">Select your Waterloo program</option>
                    {referenceData.programs.map((program) => (
                      <option key={program} value={program}>
                        {program}
                      </option>
                    ))}
                  </select>
                  {signupSubmitted && signupErrors.program && (
                    <p className="error-text">{signupErrors.program}</p>
                  )}
                </div>

                <div className="field field-full checkbox-group">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      name="wants_option"
                      checked={signupForm.wants_option}
                      onChange={handleSignupChange}
                      disabled={!signupIsEngineering}
                    />
                    Interested in getting an option
                  </label>

                  {!signupIsEngineering && signupForm.program && (
                    <p className="helper-text">
                      In this version, options are currently limited to Waterloo Engineering programs.
                    </p>
                  )}

                  {signupIsEngineering && (
                    <MultiSelectDropdown
                      label="Engineering options"
                      options={referenceData.engineeringOptions}
                      selectedValues={signupForm.desired_option}
                      onToggleValue={(value) =>
                        toggleSignupSelection("desired_option", value)
                      }
                      disabled={!signupForm.wants_option}
                      placeholder="Select up to 3 options"
                      helperText={`Selected ${signupForm.desired_option.length}/3 options · Combined total ${getCombinedSelectionCount(
                        signupForm
                      )}/4`}
                      invalid={signupSubmitted && !!signupErrors.desired_option}
                      errorText={signupErrors.desired_option}
                    />
                  )}
                </div>

                <div className="field field-full checkbox-group">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      name="wants_minor"
                      checked={signupForm.wants_minor}
                      onChange={handleSignupChange}
                    />
                    Interested in getting a minor
                  </label>

                  <p className="helper-text">
                    Engineering students can still express interest here, but elective room may be tight.
                  </p>

                  <MultiSelectDropdown
                    label="Minors"
                    options={referenceData.minors}
                    selectedValues={signupForm.desired_minor}
                    onToggleValue={(value) =>
                      toggleSignupSelection("desired_minor", value)
                    }
                    disabled={!signupForm.wants_minor}
                    placeholder="Select up to 3 minors"
                    helperText={`Selected ${signupForm.desired_minor.length}/3 minors · Combined total ${getCombinedSelectionCount(
                      signupForm
                    )}/4`}
                    invalid={signupSubmitted && !!signupErrors.desired_minor}
                    errorText={signupErrors.desired_minor}
                  />
                </div>

                <div className="field">
                  <label>Expected graduation year</label>
                  <select
                    className={`input-control ${
                      signupSubmitted && signupErrors.expected_graduation_year
                        ? "invalid"
                        : ""
                    }`}
                    name="expected_graduation_year"
                    value={signupForm.expected_graduation_year}
                    onChange={handleSignupChange}
                  >
                    <option value="">Select a year</option>
                    {graduationYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  {signupSubmitted && signupErrors.expected_graduation_year && (
                    <p className="error-text">
                      {signupErrors.expected_graduation_year}
                    </p>
                  )}
                </div>

                <div className="field">
                  <label>Current academic or co-op term</label>
                  <select
                    className={`input-control ${
                      signupSubmitted && signupErrors.current_term ? "invalid" : ""
                    }`}
                    name="current_term"
                    value={signupForm.current_term}
                    onChange={handleSignupChange}
                  >
                    <option value="">Select your term</option>
                    {referenceData.termLabels.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </select>
                  {signupSubmitted && signupErrors.current_term && (
                    <p className="error-text">{signupErrors.current_term}</p>
                  )}
                </div>

                <button className="primary-button field-full" type="submit">
                  Create Account
                </button>
              </form>
            ) : (
              <form className="form-grid" onSubmit={handleLogin}>
                <h2>Login</h2>

                <div className="field field-full">
                  <label>Email</label>
                  <input
                    className={`input-control ${
                      loginSubmitted && loginErrors.email ? "invalid" : ""
                    }`}
                    name="email"
                    type="email"
                    value={loginForm.email}
                    onChange={handleLoginChange}
                    placeholder="Email"
                  />
                  {loginSubmitted && loginErrors.email && (
                    <p className="error-text">{loginErrors.email}</p>
                  )}
                </div>

                <div className="field field-full">
                  <label>Password</label>
                  <input
                    className={`input-control ${
                      loginSubmitted && loginErrors.password ? "invalid" : ""
                    }`}
                    name="password"
                    type="password"
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    placeholder="Password"
                  />
                  {loginSubmitted && loginErrors.password && (
                    <p className="error-text">{loginErrors.password}</p>
                  )}
                </div>

                <button className="primary-button field-full" type="submit">
                  Login
                </button>
              </form>
            )}
          </>
        ) : (
          <form className="form-grid" onSubmit={handleProfileUpdate}>
            <h2>My Profile</h2>

            <div className="field">
              <label>First name</label>
              <input
                className={`input-control ${
                  profileSubmitted && profileErrors.first_name ? "invalid" : ""
                }`}
                name="first_name"
                value={user.first_name || ""}
                onChange={handleProfileChange}
              />
              {profileSubmitted && profileErrors.first_name && (
                <p className="error-text">{profileErrors.first_name}</p>
              )}
            </div>

            <div className="field">
              <label>Last name</label>
              <input
                className={`input-control ${
                  profileSubmitted && profileErrors.last_name ? "invalid" : ""
                }`}
                name="last_name"
                value={user.last_name || ""}
                onChange={handleProfileChange}
              />
              {profileSubmitted && profileErrors.last_name && (
                <p className="error-text">{profileErrors.last_name}</p>
              )}
            </div>

            <div className="field field-full">
              <label>Email</label>
              <input className="input-control" name="email" value={user.email || ""} disabled />
            </div>

            <div className="field field-full">
              <label>Program</label>
              <select
                className={`input-control ${
                  profileSubmitted && profileErrors.program ? "invalid" : ""
                }`}
                name="program"
                value={user.program || ""}
                onChange={handleProfileChange}
              >
                <option value="">Select your Waterloo program</option>
                {referenceData.programs.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </select>
              {profileSubmitted && profileErrors.program && (
                <p className="error-text">{profileErrors.program}</p>
              )}
            </div>

            <div className="field field-full checkbox-group">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="wants_option"
                  checked={!!user.wants_option}
                  onChange={handleProfileChange}
                  disabled={!profileIsEngineering}
                />
                Interested in getting an option
              </label>

              {!profileIsEngineering && user.program && (
                <p className="helper-text">
                  In this version, options are currently limited to Waterloo Engineering programs.
                </p>
              )}

              {profileIsEngineering && (
                <MultiSelectDropdown
                  label="Engineering options"
                  options={referenceData.engineeringOptions}
                  selectedValues={normalizeSelections(user.desired_option)}
                  onToggleValue={(value) =>
                    toggleProfileSelection("desired_option", value)
                  }
                  disabled={!user.wants_option}
                  placeholder="Select up to 3 options"
                  helperText={`Selected ${normalizeSelections(user.desired_option).length}/3 options · Combined total ${getCombinedSelectionCount(
                    user
                  )}/4`}
                  invalid={profileSubmitted && !!profileErrors.desired_option}
                  errorText={profileErrors.desired_option}
                />
              )}
            </div>

            <div className="field field-full checkbox-group">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="wants_minor"
                  checked={!!user.wants_minor}
                  onChange={handleProfileChange}
                />
                Interested in getting a minor
              </label>

              <p className="helper-text">
                Engineering students often have less elective space, so treat this as a planning preference.
              </p>

              <MultiSelectDropdown
                label="Minors"
                options={referenceData.minors}
                selectedValues={normalizeSelections(user.desired_minor)}
                onToggleValue={(value) =>
                  toggleProfileSelection("desired_minor", value)
                }
                disabled={!user.wants_minor}
                placeholder="Select up to 3 minors"
                helperText={`Selected ${normalizeSelections(user.desired_minor).length}/3 minors · Combined total ${getCombinedSelectionCount(
                  user
                )}/4`}
                invalid={profileSubmitted && !!profileErrors.desired_minor}
                errorText={profileErrors.desired_minor}
              />
            </div>

            <div className="field">
              <label>Expected graduation year</label>
              <select
                className={`input-control ${
                  profileSubmitted && profileErrors.expected_graduation_year
                    ? "invalid"
                    : ""
                }`}
                name="expected_graduation_year"
                value={user.expected_graduation_year || ""}
                onChange={handleProfileChange}
              >
                <option value="">Select a year</option>
                {graduationYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {profileSubmitted && profileErrors.expected_graduation_year && (
                <p className="error-text">{profileErrors.expected_graduation_year}</p>
              )}
            </div>

            <div className="field">
              <label>Current academic or co-op term</label>
              <select
                className={`input-control ${
                  profileSubmitted && profileErrors.current_term ? "invalid" : ""
                }`}
                name="current_term"
                value={user.current_term || ""}
                onChange={handleProfileChange}
              >
                <option value="">Select your term</option>
                {referenceData.termLabels.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
              {profileSubmitted && profileErrors.current_term && (
                <p className="error-text">{profileErrors.current_term}</p>
              )}
            </div>

            <button className="primary-button field-full" type="submit">
              Save Profile
            </button>

            <button
              className="secondary-button field-full"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default App;