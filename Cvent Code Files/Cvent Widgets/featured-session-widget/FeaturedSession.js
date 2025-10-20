export class FeaturedSession extends HTMLElement {
  constructor(session, theme, config, imageURL, feesBySessionId) {
    super();

    if (!session) {
      return;
    }

    this.session = session;
    this.theme = theme;
    this.config = config;
    this.imageURL = imageURL;
    this.feesBySessionId = feesBySessionId;

    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const { description, location, startDateTime, endDateTime, category } = this.session;

    this.style.width = '32%';
    this.style.margin = '0px 8px 0px 8px';
    this.style.borderRadius = '8px';
    this.style.overflow = 'hidden';

    const sessionInfoBlock = document.createElement('div');

    // use a value from the widget configuration to override the site-wide theme
    sessionInfoBlock.style.backgroundColor = this.config.customColors?.background ?? this.theme.palette.secondary;
    sessionInfoBlock.style.height = '100%';
    sessionInfoBlock.style.display = 'flex';
    sessionInfoBlock.style.flexDirection = 'column';
    sessionInfoBlock.style.minWidth = '100%';

    // image
    const image = document.createElement('img');
    image.src = this.imageURL;
    image.style.width = '100%';
    image.style.height = '184px';
    image.style.objectFit = 'cover';

    // session title
    const title = this.getTitleContainer();

    // session location
    const locationEle = document.createElement('h2');
    locationEle.textContent = location?.name ?? '';
    setStylesOnElement(
      { ...this.theme.header2, margin: 0, padding: '0px 10px 10px 10px', fontSize: '.75rem', display: 'inline' },
      locationEle
    );

    // description text
    const sessionDescription = document.createElement('p');
    sessionDescription.innerHTML = description;
    setStylesOnElement(
      { ...this.theme.mainText, margin: 0, padding: '10px', fontSize: '.75rem', flexGrow: '1' },
      sessionDescription
    );

    // Session Category
    const sessionCategory = document.createElement('div');
    setStylesOnElement(
      {
        backgroundColor: this.theme.palette.accent,
        padding: '2px 4px 2px 4px',
        fontSize: '.75rem',
        display: 'block'
      },
      sessionCategory
    );

    const sessionCategoryName = document.createElement('p');
    sessionCategoryName.textContent = category.name;
    setStylesOnElement(
      {
        ...this.theme.paragraph,
        margin: '0px',
        display: 'inline'
      },
      sessionCategoryName
    );

    const sessionCategoryDescription = document.createElement('div');
    sessionCategoryDescription.innerHTML = category.description;
    setStylesOnElement(
      {
        ...this.theme.altParagraph,
        margin: '0px',
        display: 'none',
        fontSize: '.75rem'
      },
      sessionCategoryDescription
    );

    // Display the session category description on mouseover
    sessionCategory.onmouseenter = () => {
      if (category.description) {
        sessionCategoryDescription.style.display = 'block';
        sessionCategoryDescription.style.margin = '5px';
      }
    };

    sessionCategory.onmouseleave = () => {
      sessionCategoryDescription.style.display = 'none';
      sessionCategoryDescription.style.margin = '0px';
    };

    sessionCategory.append(sessionCategoryName, sessionCategoryDescription);

    // Speaker Elements
    const speakers = document.createElement('div');
    speakers.style.display = 'flex';

    this.session.speakers.forEach(speaker => {
      const speakerContainer = document.createElement('div');
      setStylesOnElement(
        {
          backgroundColor: this.theme.palette.accent,
          padding: '2px 4px 2px 4px',
          margin: '5px',
          display: 'flex',
          borderRadius: '10px'
        },
        speakerContainer
      );

      const speakerProfilePicture = document.createElement('img');
      speakerProfilePicture.src = speaker.profilePictureUri;
      setStylesOnElement(
        {
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          margin: '5px',
          objectFit: 'cover'
        },
        speakerProfilePicture
      );

      const speakerName = document.createElement('div');
      speakerName.textContent = speaker.firstName + ' ' + speaker.lastName;
      setStylesOnElement(
        {
          ...this.theme.paragraph,
          alignSelf: 'center',
          margin: '5px',
          fontSize: '.75rem'
        },
        speakerName
      );

      speakerContainer.append(speakerProfilePicture, speakerName);
      speakers.append(speakerContainer);
    });

    // date range text
    const timeRange = document.createElement('h2');
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const options = { dateStyle: 'medium', timeStyle: 'short' };

    timeRange.textContent = `${start.toLocaleString('en-US', options)} - ${end.toLocaleString('en-US', options)}`;

    setStylesOnElement(
      {
        ...this.theme.header3,
        margin: '0px',
        padding: '10px 10px 0px 10px',
        fontSize: '.75rem'
      },
      timeRange
    );

    // append all children to the div
    sessionInfoBlock.append(image, timeRange, locationEle, title, sessionCategory, sessionDescription, speakers);
    this.shadowRoot.append(sessionInfoBlock);
  }

  getTitleContainer = () => {
    const titleContainer = document.createElement('div');
    const title = document.createElement('h1');

    setStylesOnElement({ ...this.theme.header1, margin: 0, padding: '0px 10px 0px 10px', fontSize: '1.5rem' }, title);
    titleContainer.append(title);

    // return if fee not configured
    if (!this.config.showFees) {
      title.textContent = this.session.name;
      return titleContainer;
    }
    const fee = this.feesBySessionId[this.session.id];

    if (!fee) {
      title.textContent = `${this.session.name} - Free`;
      return titleContainer;
    }

    const chargePolicies = getApplicableChargePolicies(fee);
    title.textContent = `${this.session.name} - $${chargePolicies[0].amount}`;

    // early bird pricing
    if (chargePolicies.length > 1) {
      const deadline = document.createElement('h2');
      const earlyBirdUntil = new Date(chargePolicies[0].effectiveUntil);
      // assume event timezone is UTC
      const earlyBirdUntilUTC = new Date(earlyBirdUntil.getTime() + earlyBirdUntil.getTimezoneOffset() * 60 * 1000);

      deadline.textContent = `Changes to $${chargePolicies[1].amount} after ${earlyBirdUntilUTC.toLocaleDateString(
        'en-US',
        { dateStyle: 'medium' }
      )}`;

      setStylesOnElement(
        {
          ...this.theme.header2,
          margin: '0',
          padding: '10px 10px 0px 10px',
          fontSize: '.75rem'
        },
        deadline
      );

      titleContainer.append(deadline);
    }
    return titleContainer;
  };
}

/**
 * Applies an object contianing css styles to the provided element
 * The style objects provided in the `theme` constructor parameter for specific kinds of text (Header1, Secondary Button, etc.)
 * can be passed to `style` to match the styling of other text outside of your custom widget.
 * @param style  an object mapping css properties as keys to vthe desired values
 * @param element the HTML element to apply styles too
 */
const setStylesOnElement = (style, element) => {
  Object.assign(element.style, style);
  element.classList.add(...(style.customClasses || []));
};

const getApplicableChargePolicies = fee => {
  const now = Date.now();
  return (
    fee.chargePolicies
      .filter(chargePolicy => chargePolicy.isActive)
      // early bird pricing is effective through the day specified in effectiveUntil date string
      .filter(chargePolicy => new Date(chargePolicy.effectiveUntil).getTime() + 24 * 60 * 60 * 1000 > now)
      .sort(
        (chargePolicy1, chargePolicy2) =>
          new Date(chargePolicy1.effectiveUntil).getTime() - new Date(chargePolicy2.effectiveUntil).getTime()
      )
  );
};
